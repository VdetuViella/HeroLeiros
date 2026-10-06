import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { memberships, users } from "../db/schema";
import type { Db } from "../db/types";
import type { SessionUser } from "../session";
import { directorGroups } from "../groups/service";
import { createTestDb, insertUser } from "../test/db";
import { getInvitation, postAcceptInvitation, postGroup, postRegenerateInvite } from "./groups";
import type { ApiContext } from "./http";

let db: Db;
let close: () => Promise<void>;

/** Contexto que relee el rol de la base, como hace Better Auth en cada petición. */
function ctxAs(user: SessionUser | null): ApiContext {
  return {
    db,
    getUser: async () => {
      if (!user) return null;
      const [row] = await db.select().from(users).where(eq(users.id, user.id));
      return { ...user, role: row.role };
    },
  };
}

const req = (body?: unknown) =>
  new Request("http://test/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(() => close());

describe("grupos e invitaciones", () => {
  it("crear un grupo convierte al usuario en director y genera un enlace", async () => {
    const marta = await insertUser(db, { id: "marta", name: "Marta" });
    expect((await postGroup(req({ name: "  Bloco   Leiros " }), ctxAs(null))).status).toBe(401);
    expect((await postGroup(req({ name: "x" }), ctxAs(marta))).status).toBe(400);

    const res = await postGroup(req({ name: "  Bloco   Leiros " }), ctxAs(marta));
    expect(res.status).toBe(201);
    const group = (await res.json()) as { id: string; name: string; inviteCode: string };
    expect(group.name).toBe("Bloco Leiros");
    expect(group.inviteCode).toMatch(/^[a-z2-9]{10}$/);

    const [row] = await db.select().from(users).where(eq(users.id, "marta"));
    expect(row.role).toBe("director");

    const info = await getInvitation(req(), ctxAs(null), group.inviteCode.toUpperCase());
    expect(await info.json()).toEqual({ groupName: "Bloco Leiros", directorName: "Marta" });
  });

  it("un miembro se une con el enlace una sola vez; el director no", async () => {
    const dir = await insertUser(db, { id: "dir2", name: "Dirce" });
    const { id: groupId, inviteCode } = (await (await postGroup(req({ name: "Grupo 2" }), ctxAs(dir))).json()) as {
      id: string;
      inviteCode: string;
    };
    const pablo = await insertUser(db, { id: "pablo", name: "Pablo" });

    expect((await postAcceptInvitation(req(), ctxAs(null), inviteCode)).status).toBe(401);
    expect((await postAcceptInvitation(req(), ctxAs(pablo), "noexiste00")).status).toBe(404);

    const first = await postAcceptInvitation(req(), ctxAs(pablo), inviteCode);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ groupId, joined: true });
    const second = await postAcceptInvitation(req(), ctxAs(pablo), inviteCode);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ joined: false });
    expect(await db.$count(memberships, eq(memberships.groupId, groupId))).toBe(1);

    expect((await postAcceptInvitation(req(), ctxAs(dir), inviteCode)).status).toBe(409);

    const [listed] = await directorGroups(db, dir.id);
    expect(listed).toMatchObject({ id: groupId, name: "Grupo 2", members: 1 });
  });

  it("regenerar el enlace invalida el anterior y solo lo puede hacer su director", async () => {
    const dir = await insertUser(db, { id: "dir3", name: "Dora" });
    const otro = await insertUser(db, { id: "dir4", name: "Otto" });
    const group = (await (await postGroup(req({ name: "Grupo 3" }), ctxAs(dir))).json()) as {
      id: string;
      inviteCode: string;
    };
    await postGroup(req({ name: "Grupo de Otto" }), ctxAs(otro));
    const miembro = await insertUser(db, { id: "mimi", name: "Mimi" });

    expect((await postRegenerateInvite(req(), ctxAs(miembro), group.id)).status).toBe(403);
    expect((await postRegenerateInvite(req(), ctxAs(otro), group.id)).status).toBe(403);
    expect((await postRegenerateInvite(req(), ctxAs(dir), "no-es-uuid")).status).toBe(404);

    const res = await postRegenerateInvite(req(), ctxAs(dir), group.id);
    expect(res.status).toBe(200);
    const { inviteCode } = (await res.json()) as { inviteCode: string };
    expect(inviteCode).not.toBe(group.inviteCode);
    expect((await postAcceptInvitation(req(), ctxAs(miembro), group.inviteCode)).status).toBe(404);
    expect((await postAcceptInvitation(req(), ctxAs(miembro), inviteCode)).status).toBe(201);
  });
});
