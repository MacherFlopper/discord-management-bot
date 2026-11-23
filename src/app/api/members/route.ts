import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const db = getDb();
  const rows = guildId
    ? db.prepare("SELECT * FROM members WHERE guild_id = ? ORDER BY display_name ASC LIMIT 500").all(guildId)
    : db.prepare("SELECT * FROM members ORDER BY display_name ASC LIMIT 500").all();
  return NextResponse.json(rows);
}
