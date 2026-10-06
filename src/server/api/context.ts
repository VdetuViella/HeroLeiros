import { getAuth } from "../auth";
import { getDb } from "../db/client";
import { sessionUserGetter } from "../session";
import type { ApiContext } from "./http";

export function appContext(): ApiContext {
  return { db: getDb(), getUser: sessionUserGetter(getAuth()) };
}
