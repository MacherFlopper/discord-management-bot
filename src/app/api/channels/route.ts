import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const db = getDb();
  const rows = guildId
    ? db.prepare("SELECT channels.*, guilds.name AS guild_name FROM channels JOIN guilds ON guilds.id = channels.guild_id WHERE guild_id = ? ORDER BY position").all(guildId)
    : db.prepare("SELECT channels.*, guilds.name AS guild_name FROM channels JOIN guilds ON guilds.id = channels.guild_id ORDER BY guild_name, position").all();
  return NextResponse.json(rows);
}
