import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { postAttempts } from "./api/attempts";
import { postGroup } from "./api/groups";
import type { ApiContext } from "./api/http";
import { createAuth, type Auth } from "./auth";
import { attempts, users } from "./db/schema";
import type { Db } from "./db/types";
import { sessionUserGetter } from "./session";
import { createTestDb } from "./test/db";
import { makeAttempt } from "./test/fixtures";

const BASE = "http://127.0.0.1:43147";
let db: Db;
let close: () => Promise<void>;
let auth: Auth;
let ctx: ApiContext;

function authRequest(path: string, body: unknown, cookie?: string): Request {
  return new Request(`${BASE}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  auth = createAuth(db, { baseURL: BASE, secret: "secreto-de-pruebas-con-32-caracteres!" });
  ctx = { db, getUser: sessionUserGetter(auth) };
});

afterAll(() => close());

describe("Better Auth sobre el esquema de Drizzle", () => {
  it("registro con email y contraseña: rol miembro y sesión por cookie", async () => {
    const res = await auth.handler(
      authRequest("/sign-up/email", { name: "Lucía", email: "lucia@example.test", password: "batucada123" }),
    );
    expect(res.status).toBe(200);
    const cookie = cookieFrom(res);
    expect(cookie).toContain("better-auth.session_token=");

    const user = await ctx.getUser(new Headers({ cookie }));
    expect(user).toMatchObject({ name: "Lucía", email: "lucia@example.test", role: "miembro" });

    const post = new Request(`${BASE}/api/attempts`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ key: "k1", result: makeAttempt() }),
    });
    expect((await postAttempts(post, ctx)).status).toBe(201);
    const [row] = await db.select().from(attempts);
    expect(row.userId).toBe(user!.id);
  });

  it("el cliente no puede darse el rol de director al registrarse", async () => {
    const res = await auth.handler(
      authRequest("/sign-up/email", {
        name: "Pícaro",
        email: "picaro@example.test",
        password: "batucada123",
        role: "director",
      }),
    );
    const [row] = await db.select().from(users).where(eq(users.email, "picaro@example.test"));
    expect(res.ok ? row.role : "rechazado").not.toBe("director");
  });

  it("crear un grupo cambia el rol en la sesión siguiente", async () => {
    const signIn = await auth.handler(
      authRequest("/sign-in/email", { email: "lucia@example.test", password: "batucada123" }),
    );
    expect(signIn.status).toBe(200);
    const cookie = cookieFrom(signIn);
    const create = new Request(`${BASE}/api/groups`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Bloco de Lucía" }),
    });
    expect((await postGroup(create, ctx)).status).toBe(201);
    expect((await ctx.getUser(new Headers({ cookie })))?.role).toBe("director");
  });

  it("contraseña incorrecta no abre sesión", async () => {
    const res = await auth.handler(authRequest("/sign-in/email", { email: "lucia@example.test", password: "otra-cosa" }));
    expect(res.status).toBe(401);
  });
});
