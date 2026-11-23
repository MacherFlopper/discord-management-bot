import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json([]);
  return NextResponse.json(
    getDb().prepare("SELECT command_id, name, description, updated_at FROM bot_commands WHERE guild_id = ? ORDER BY name").all(guildId),
  );
}
