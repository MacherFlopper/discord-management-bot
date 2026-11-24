import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../../lib/api-auth";
import { publishPriceAnnouncement } from "../../../../../lib/discord-price-announcements";
import { getDb } from "../../../../../lib/db";
import { ensureSpawnerPrices } from "../../../../../lib/spawner-prices";
import { createSpawnerPriceListEmbed } from "../../../../../lib/spawner-price-embeds";

export async function POST(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Inhalt." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Serverauswahl fehlt." }, { status: 400 });
  }

  const { guildId } = body as Record<string, unknown>;
  if (typeof guildId !== "string" || !authorization.guildIds.includes(guildId)) {
    return NextResponse.json({ error: "Keine Berechtigung für diesen Discord-Server." }, { status: 403 });
  }

  const db = getDb();
  const settings = db.prepare("SELECT channel_id FROM price_announcement_channels WHERE guild_id = ?").get(guildId) as
    | { channel_id: string }
    | undefined;
  if (!settings) {
    return NextResponse.json({ error: "Wähle zuerst einen Discord-Ankündigungskanal aus." }, { status: 409 });
  }

  const channel = db.prepare("SELECT type FROM channels WHERE guild_id = ? AND id = ?").get(guildId, settings.channel_id) as
    | { type: number }
    | undefined;
  if (!channel || (channel.type !== 0 && channel.type !== 5)) {
    return NextResponse.json({ error: "Der gespeicherte Ankündigungskanal ist nicht mehr verfügbar." }, { status: 409 });
  }

  try {
    await publishPriceAnnouncement(settings.channel_id, {
      embeds: [createSpawnerPriceListEmbed(ensureSpawnerPrices(guildId))],
    });
  } catch (error) {
    console.error(`Spawnerpreisliste für ${guildId} konnte nicht gesendet werden:`, error);
    return NextResponse.json({ error: "Die Preisliste konnte nicht in Discord gesendet werden." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
