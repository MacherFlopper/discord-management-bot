import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";

type RouteContext = { params: Promise<{ clanId: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  const { clanId: roleId } = await params;
  const guildId = new URL(request.url).searchParams.get("guildId");
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });
  const result = getDb().prepare("DELETE FROM clan_roles WHERE guild_id = ? AND role_id = ?").run(guildId, roleId);
  if (!result.changes) return NextResponse.json({ error: "Clan-Rolle nicht gefunden." }, { status: 404 });
  return NextResponse.json({ success: true });
}
