import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });
  const db = getDb();
  const settings = db.prepare("SELECT * FROM settings WHERE guild_id = ?").get(guildId);
  return NextResponse.json(settings || {
    guild_id: guildId,
    welcome_channel_id: null,
    welcome_message: "Willkommen {user} auf {server}!",
    module_config_json: "{}",
  });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { guildId?: unknown; welcomeChannelId?: unknown; welcomeMessage?: unknown };
    if (typeof body.guildId !== "string" || !body.guildId) {
      return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });
    }
    const welcomeChannelId = typeof body.welcomeChannelId === "string" && body.welcomeChannelId ? body.welcomeChannelId : null;
    const welcomeMessage = typeof body.welcomeMessage === "string" ? body.welcomeMessage.trim() : "";
    if (welcomeMessage.length > 1000) {
      return NextResponse.json({ error: "Die Willkommensnachricht darf maximal 1000 Zeichen lang sein." }, { status: 400 });
    }
    const db = getDb();
    if (!db.prepare("SELECT id FROM guilds WHERE id = ?").get(body.guildId)) {
      return NextResponse.json({ error: "Discord-Server nicht gefunden." }, { status: 404 });
    }
    if (welcomeChannelId && !db.prepare("SELECT id FROM channels WHERE guild_id = ? AND id = ? AND type IN (0, 5)").get(body.guildId, welcomeChannelId)) {
      return NextResponse.json({ error: "Der Willkommens-Channel ist ungültig." }, { status: 400 });
    }
    db.prepare(`
      INSERT INTO settings (guild_id, welcome_channel_id, welcome_message, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET welcome_channel_id=excluded.welcome_channel_id,
        welcome_message=excluded.welcome_message, updated_at=excluded.updated_at
    `).run(body.guildId, welcomeChannelId, welcomeMessage, new Date().toISOString());
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Einstellungen konnten nicht gespeichert werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
