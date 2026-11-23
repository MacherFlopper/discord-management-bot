import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../../../lib/api-auth";
import { getDb } from "../../../../../../lib/db";

type RouteContext = { params: Promise<{ clanId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { clanId: roleId } = await params;
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });

  const db = getDb();
  const rows = db.prepare("SELECT id, username, display_name, avatar, roles_json FROM members WHERE guild_id = ? ORDER BY display_name COLLATE NOCASE").all(guildId) as
    { id: string; username: string; display_name: string | null; avatar: string | null; roles_json: string }[];
  const result = [];
  for (const member of rows) {
    let roleIds: string[];
    try {
      roleIds = JSON.parse(member.roles_json) as string[];
    } catch (error) {
      console.error(`Invalid member role cache for ${guildId}/${member.id}:`, error);
      continue;
    }
    if (roleIds.includes(roleId)) {
      result.push({ id: member.id, username: member.username, display_name: member.display_name, avatar: member.avatar });
    }
  }
  return NextResponse.json(result);
}
