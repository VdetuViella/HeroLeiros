import { appContext } from "@/server/api/context";
import { postGroup } from "@/server/api/groups";
import { runRoute } from "@/server/api/http";

export function POST(request: Request) {
  return runRoute(appContext, (ctx) => postGroup(request, ctx));
}
