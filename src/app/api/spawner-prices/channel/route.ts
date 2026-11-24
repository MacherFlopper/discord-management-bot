import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../../lib/api-auth";
import { getDb } from "../../../../../lib/db";

export async function PUT(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Inhalt." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Server- oder Channel-Auswahl." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { guildId, channelId } = input;
  if (
    typeof guildId !== "string"
    || !authorization.guildIds.includes(guildId)
    || typeof channelId !== "string"
  ) {
    return NextResponse.json({ error: "Ungültige Server- oder Channel-Auswahl." }, { status: 400 });
  }

  const db = getDb();
  if (!channelId) {
    db.prepare("DELETE FROM price_announcement_channels WHERE guild_id = ?").run(guildId);
    return NextResponse.json({ success: true, channelId: null });
  }

  const channel = db.prepare("SELECT type FROM channels WHERE guild_id = ? AND id = ?").get(guildId, channelId) as
    | { type: number }
    | undefined;
  if (!channel || (channel.type !== 0 && channel.type !== 5)) {
    return NextResponse.json({ error: "Wähle einen Text- oder Ankündigungskanal dieses Servers." }, { status: 400 });
  }

  db.prepare(`
    INSERT INTO price_announcement_channels (guild_id, channel_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id, updated_at = excluded.updated_at
  `).run(guildId, channelId, new Date().toISOString());
  return NextResponse.json({ success: true, channelId });
}
