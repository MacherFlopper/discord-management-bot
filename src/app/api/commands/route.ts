import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  if (!guildId) return NextResponse.json([]);
  return NextResponse.json(
    getDb().prepare("SELECT command_id, name, description, updated_at FROM bot_commands WHERE guild_id = ? ORDER BY name").all(guildId),
  );
}
