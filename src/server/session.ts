import { ROLES, type Role } from "./db/schema";
import type { Auth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export type GetSessionUser = (headers: Headers) => Promise<SessionUser | null>;

function toRole(value: unknown): Role {
  return (ROLES as readonly unknown[]).includes(value) ? (value as Role) : "miembro";
}

export function sessionUserGetter(auth: Auth): GetSessionUser {
  return async (headers) => {
    const session = await auth.api.getSession({ headers });
    if (!session) return null;
    const { id, name, email, role } = session.user;
    return { id, name, email, role: toRole(role) };
  };
}
