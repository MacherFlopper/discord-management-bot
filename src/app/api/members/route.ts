import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId && !authorization.guildIds.length) return NextResponse.json([]);

  const db = getDb();
  const rows = guildId
    ? db.prepare("SELECT * FROM members WHERE guild_id = ? ORDER BY display_name ASC LIMIT 500").all(guildId)
    : db.prepare(`SELECT * FROM members WHERE guild_id IN (${authorization.guildIds.map(() => "?").join(",")}) ORDER BY display_name ASC LIMIT 500`).all(...authorization.guildIds);
  return NextResponse.json(rows);
}
