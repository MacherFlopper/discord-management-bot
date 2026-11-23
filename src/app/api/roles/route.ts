import { NextResponse } from "next/server";
import { hasClanRestrictedPermissions } from "../../../../lib/discord-permissions";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const db = getDb();
  const rows = (guildId
    ? db.prepare("SELECT roles.*, guilds.name AS guild_name FROM roles JOIN guilds ON guilds.id = roles.guild_id WHERE guild_id = ? ORDER BY position DESC").all(guildId)
    : db.prepare("SELECT roles.*, guilds.name AS guild_name FROM roles JOIN guilds ON guilds.id = roles.guild_id ORDER BY guild_name, position DESC").all()) as
      { id: string; name: string; permissions: string; managed: number }[];
  return NextResponse.json(rows.map((role) => ({
    ...role,
    clan_eligible: role.name !== "@everyone" && role.managed === 0 && !hasClanRestrictedPermissions(role.permissions),
  })));
}
