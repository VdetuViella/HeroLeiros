import { z } from "zod";

import { createGroup, findGroupByInvite, joinGroupByInvite, regenerateInvite } from "../groups/service";
import { forbidden, isUuid, jsonError, readJson, withUser, type ApiContext } from "./http";

const createGroupSchema = z.object({ name: z.string().trim().min(2).max(80) });

/** `POST /api/groups` — crea un grupo; quien lo crea pasa a ser director. */
export function postGroup(request: Request, ctx: ApiContext): Promise<Response> {
  return withUser(request, ctx, async (user) => {
    const body = await readJson(request);
    const parsed = body.ok ? createGroupSchema.safeParse(body.value) : null;
    if (!parsed?.success) return jsonError(400, "El nombre del grupo debe tener entre 2 y 80 caracteres.");
    const group = await createGroup(ctx.db, user, parsed.data.name);
    return Response.json({ id: group.id, name: group.name, inviteCode: group.inviteCode }, { status: 201 });
  });
}

/** `POST /api/groups/:id/invite` — regenera el enlace de invitación (solo el director del grupo). */
export function postRegenerateInvite(request: Request, ctx: ApiContext, groupId: string): Promise<Response> {
  return withUser(request, ctx, async (user) => {
    if (user.role !== "director") return forbidden("Solo el director puede cambiar el enlace de invitación.");
    if (!isUuid(groupId)) return jsonError(404, "Ese grupo no existe.");
    const inviteCode = await regenerateInvite(ctx.db, user.id, groupId);
    if (!inviteCode) return forbidden("Ese grupo no lo diriges tú.");
    return Response.json({ inviteCode });
  });
}

/** `GET /api/invitations/:code` — datos públicos de la invitación. */
export async function getInvitation(_request: Request, ctx: ApiContext, code: string): Promise<Response> {
  const group = await findGroupByInvite(ctx.db, code);
  if (!group) return jsonError(404, "Esta invitación no existe o ha caducado.");
  return Response.json({ groupName: group.name, directorName: group.directorName });
}

/** `POST /api/invitations/:code` — el usuario con sesión se une al grupo. */
export function postAcceptInvitation(request: Request, ctx: ApiContext, code: string): Promise<Response> {
  return withUser(request, ctx, async (user) => {
    const outcome = await joinGroupByInvite(ctx.db, user, code);
    switch (outcome.kind) {
      case "no-existe":
        return jsonError(404, "Esta invitación no existe o ha caducado.");
      case "es-director":
        return jsonError(409, "Ya diriges este grupo.", { groupId: outcome.groupId });
      case "unido":
        return Response.json({ groupId: outcome.groupId, groupName: outcome.groupName, joined: true }, { status: 201 });
      case "ya-miembro":
        return Response.json({ groupId: outcome.groupId, groupName: outcome.groupName, joined: false });
      default: {
        const unreachable: never = outcome;
        return unreachable;
      }
    }
  });
}
