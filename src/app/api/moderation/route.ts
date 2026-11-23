import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const db = getDb();
  const rows = guildId
    ? db.prepare("SELECT * FROM moderation_cases WHERE guild_id = ? ORDER BY created_at DESC").all(guildId)
    : db.prepare("SELECT * FROM moderation_cases ORDER BY created_at DESC").all();
  return NextResponse.json(rows);
}
