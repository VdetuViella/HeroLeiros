import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/server/auth";
import { isDatabaseConfigured } from "@/server/db/client";
import { jsonError } from "@/server/api/http";

async function handle(request: Request): Promise<Response> {
  if (!isDatabaseConfigured()) {
    return jsonError(503, "Las cuentas no están configuradas en este servidor.", { code: "sin-base-de-datos" });
  }
  return getAuth().handler(request);
}

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handle);
