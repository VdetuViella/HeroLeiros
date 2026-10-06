import { getAttempts, postAttempts } from "@/server/api/attempts";
import { appContext } from "@/server/api/context";
import { runRoute } from "@/server/api/http";

export function GET(request: Request) {
  return runRoute(appContext, (ctx) => getAttempts(request, ctx));
}

export function POST(request: Request) {
  return runRoute(appContext, (ctx) => postAttempts(request, ctx));
}
