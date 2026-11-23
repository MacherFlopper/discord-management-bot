import { NextResponse } from "next/server";
import { hasClanRestrictedPermissions } from "../../../../lib/discord-permissions";
import { getDb } from "../../../../lib/db";

type ClanRoleRow = {
  guild_id: string;
  role_id: string;
  created_at: string;
  guild_name: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  managed: number;
};

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const db = getDb();
  const rows = (guildId
    ? db.prepare(`
        SELECT clan_roles.*, guilds.name AS guild_name, roles.name, roles.color, roles.position,
          roles.permissions, roles.managed
        FROM clan_roles
        JOIN guilds ON guilds.id = clan_roles.guild_id
        JOIN roles ON roles.guild_id = clan_roles.guild_id AND roles.id = clan_roles.role_id
        WHERE clan_roles.guild_id = ?
        ORDER BY roles.position DESC
      `).all(guildId)
    : db.prepare(`
        SELECT clan_roles.*, guilds.name AS guild_name, roles.name, roles.color, roles.position,
          roles.permissions, roles.managed
        FROM clan_roles
        JOIN guilds ON guilds.id = clan_roles.guild_id
        JOIN roles ON roles.guild_id = clan_roles.guild_id AND roles.id = clan_roles.role_id
        ORDER BY guild_name, roles.position DESC
      `).all()) as ClanRoleRow[];
  const members = (guildId
    ? db.prepare("SELECT guild_id, id, roles_json FROM members WHERE guild_id = ?").all(guildId)
    : db.prepare("SELECT guild_id, id, roles_json FROM members").all()) as { guild_id: string; id: string; roles_json: string }[];

  const counts = new Map<string, number>();
  for (const member of members) {
    let roleIds: string[];
    try {
      roleIds = JSON.parse(member.roles_json) as string[];
    } catch (error) {
      console.error(`Invalid member role cache for ${member.guild_id}/${member.id}:`, error);
      continue;
    }
    for (const roleId of roleIds) {
      const key = `${member.guild_id}:${roleId}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return NextResponse.json(rows.map((role) => ({
    ...role,
    member_count: counts.get(`${role.guild_id}:${role.role_id}`) || 0,
  })));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { guildId?: unknown; roleId?: unknown };
    if (typeof body.guildId !== "string" || typeof body.roleId !== "string") {
      return NextResponse.json({ error: "Server und Rolle müssen ausgewählt werden." }, { status: 400 });
    }
    const db = getDb();
    const role = db.prepare("SELECT id, name, managed, permissions FROM roles WHERE guild_id = ? AND id = ?").get(body.guildId, body.roleId) as
      | { id: string; name: string; managed: number; permissions: string }
      | undefined;
    if (!role) return NextResponse.json({ error: "Die Rolle wurde noch nicht synchronisiert." }, { status: 404 });
    if (role.name === "@everyone" || role.managed) {
      return NextResponse.json({ error: "Diese Discord-Rolle kann nicht als Clan-Rolle verwendet werden." }, { status: 400 });
    }
    if (hasClanRestrictedPermissions(role.permissions)) {
      return NextResponse.json({ error: "Rollen mit Administrations- oder Moderationsrechten dürfen keine Clan-Rollen sein." }, { status: 400 });
    }
    db.prepare(`
      INSERT INTO clan_roles (guild_id, role_id, created_at) VALUES (?, ?, ?)
      ON CONFLICT(guild_id, role_id) DO NOTHING
    `).run(body.guildId, body.roleId, new Date().toISOString());
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clan-Rolle konnte nicht gespeichert werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
