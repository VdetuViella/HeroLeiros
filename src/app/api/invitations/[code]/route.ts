import { appContext } from "@/server/api/context";
import { getInvitation, postAcceptInvitation } from "@/server/api/groups";
import { runRoute } from "@/server/api/http";

export async function GET(request: Request, ctx: RouteContext<"/api/invitations/[code]">) {
  const { code } = await ctx.params;
  return runRoute(appContext, (api) => getInvitation(request, api, code));
}

export async function POST(request: Request, ctx: RouteContext<"/api/invitations/[code]">) {
  const { code } = await ctx.params;
  return runRoute(appContext, (api) => postAcceptInvitation(request, api, code));
}
