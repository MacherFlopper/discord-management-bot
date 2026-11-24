import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { getClanPrices } from "../../../../lib/clan-pricing";
import { hasClanRestrictedPermissions } from "../../../../lib/discord-permissions";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId && !authorization.guildIds.length) return NextResponse.json([]);
  return NextResponse.json(getClanPrices(guildId ? [guildId] : authorization.guildIds));
}

export async function POST(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;
  try {
    const body = await request.json() as { guildId?: unknown; roleId?: unknown };
    if (typeof body.guildId !== "string" || typeof body.roleId !== "string") {
      return NextResponse.json({ error: "Server und Rolle müssen ausgewählt werden." }, { status: 400 });
    }
    if (!authorization.guildIds.includes(body.guildId)) {
      return NextResponse.json({ error: "Keine Berechtigung für diesen Discord-Server." }, { status: 403 });
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
