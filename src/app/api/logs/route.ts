import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const db = getDb();
  const rows = guildId
    ? db.prepare("SELECT * FROM logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT 200").all(guildId)
    : db.prepare("SELECT * FROM logs ORDER BY created_at DESC LIMIT 200").all();
  return NextResponse.json(rows);
}
