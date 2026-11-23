import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;
  if (!authorization.guildIds.length) return NextResponse.json([]);

  const placeholders = authorization.guildIds.map(() => "?").join(",");
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM guilds WHERE id IN (${placeholders}) ORDER BY name ASC`).all(...authorization.guildIds);
  return NextResponse.json(rows);
}
