import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { publishPriceAnnouncement } from "../../../../lib/discord-price-announcements";
import { getDb } from "../../../../lib/db";
import { ensureSpawnerPrices } from "../../../../lib/spawner-prices";
import { formatMillions, SPAWNER_DEFAULTS } from "../../../../lib/pricing";

const maxPrice = 1_000_000_000_000;

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });

  const db = getDb();
  const prices = ensureSpawnerPrices(guildId);
  const history = db.prepare(`
    SELECT spawner_key, old_buy_price, new_buy_price, old_sell_price, new_sell_price, created_at
    FROM spawner_price_history
    WHERE guild_id = ?
    ORDER BY id DESC
    LIMIT 30
  `).all(guildId);
  const settings = db.prepare("SELECT channel_id FROM price_announcement_channels WHERE guild_id = ?").get(guildId) as
    | { channel_id: string }
    | undefined;
  return NextResponse.json({ prices, history, announcementChannelId: settings?.channel_id || null });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Inhalt." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Preisangaben." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { guildId, spawnerKey, buyPrice, sellPrice } = input;
  if (
    typeof guildId !== "string"
    || !authorization.guildIds.includes(guildId)
    || typeof spawnerKey !== "string"
    || !SPAWNER_DEFAULTS.some((spawner) => spawner.key === spawnerKey)
    || typeof buyPrice !== "number"
    || !Number.isSafeInteger(buyPrice)
    || buyPrice < 0
    || buyPrice > maxPrice
    || buyPrice % 100_000 !== 0
    || typeof sellPrice !== "number"
    || !Number.isSafeInteger(sellPrice)
    || sellPrice < 0
    || sellPrice > maxPrice
    || sellPrice % 100_000 !== 0
  ) {
    return NextResponse.json({ error: "Server oder Preise sind ungültig." }, { status: 400 });
  }

  const db = getDb();
  const prices = ensureSpawnerPrices(guildId);
  const current = prices.find((price) => price.spawner_key === spawnerKey);
  if (!current) return NextResponse.json({ error: "Spawner nicht gefunden." }, { status: 404 });
  if (current.buy_price === buyPrice && current.sell_price === sellPrice) {
    return NextResponse.json({ success: true, unchanged: true });
  }

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

  const changedAt = new Date().toISOString();
  db.exec("BEGIN");
  try {
    db.prepare(`
      UPDATE spawner_prices SET buy_price = ?, sell_price = ?, updated_at = ?
      WHERE guild_id = ? AND spawner_key = ?
    `).run(buyPrice, sellPrice, changedAt, guildId, spawnerKey);
    db.prepare(`
      INSERT INTO spawner_price_history
        (guild_id, spawner_key, old_buy_price, new_buy_price, old_sell_price, new_sell_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, spawnerKey, current.buy_price, buyPrice, current.sell_price, sellPrice, changedAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  const announcement = [
    `**MRKET CLAN · SPAWNER-PREISÄNDERUNG**`,
    `${current.emoji} **${current.name}**`,
    current.buy_price === buyPrice
      ? `Wir kaufen: **${formatMillions(buyPrice)}**`
      : `Wir kaufen: ~~${formatMillions(current.buy_price)}~~ → **${formatMillions(buyPrice)}**`,
    current.sell_price === sellPrice
      ? `Wir verkaufen: **${formatMillions(sellPrice)}**`
      : `Wir verkaufen: ~~${formatMillions(current.sell_price)}~~ → **${formatMillions(sellPrice)}**`,
    `Stand: ${new Date(changedAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`,
  ].join("\n");

  try {
    await publishPriceAnnouncement(settings.channel_id, announcement);
  } catch (error) {
    console.error(`Spawnerpreis für ${guildId}/${spawnerKey} gespeichert, Discord-Meldung fehlgeschlagen:`, error);
    return NextResponse.json({
      error: "Preis gespeichert, aber die Discord-Ankündigung konnte nicht gesendet werden.",
      saved: true,
    }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    price: ensureSpawnerPrices(guildId).find((price) => price.spawner_key === spawnerKey),
  });
}
