import { appContext } from "@/server/api/context";
import { postRegenerateInvite } from "@/server/api/groups";
import { runRoute } from "@/server/api/http";

export async function POST(request: Request, ctx: RouteContext<"/api/groups/[groupId]/invite">) {
  const { groupId } = await ctx.params;
  return runRoute(appContext, (api) => postRegenerateInvite(request, api, groupId));
}
