import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../../lib/api-auth";
import { getClanPrices } from "../../../../../lib/clan-pricing";
import { publishPriceAnnouncement } from "../../../../../lib/discord-price-announcements";
import { getDb } from "../../../../../lib/db";
import { formatWholeAmount } from "../../../../../lib/pricing";

type RouteContext = { params: Promise<{ clanId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { clanId: roleId } = await params;
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Inhalt." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Rabattangaben." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const { discountPercent, expiresAt } = input;
  const expiration = typeof expiresAt === "string" ? expiresAt : null;
  if (
    typeof discountPercent !== "number"
    || !Number.isInteger(discountPercent)
    || discountPercent < 0
    || discountPercent > 99
  ) {
    return NextResponse.json({ error: "Der Rabatt muss zwischen 0 und 99 Prozent liegen." }, { status: 400 });
  }
  if (discountPercent > 0 && (!expiration || !Number.isFinite(Date.parse(expiration)) || Date.parse(expiration) <= Date.now())) {
    return NextResponse.json({ error: "Der Rabatt braucht ein gültiges Ablaufdatum in der Zukunft." }, { status: 400 });
  }

  const db = getDb();
  const clan = getClanPrices([guildId]).find((item) => item.role_id === roleId);
  if (!clan) return NextResponse.json({ error: "Clan-Rolle nicht gefunden." }, { status: 404 });
  const previous = db.prepare(`
    SELECT discount_percent, expires_at FROM clan_discounts WHERE guild_id = ? AND role_id = ?
  `).get(guildId, roleId) as { discount_percent: number; expires_at: string } | undefined;
  if (
    (discountPercent === 0 && !previous)
    || (discountPercent > 0 && previous?.discount_percent === discountPercent && previous.expires_at === expiration)
  ) {
    return NextResponse.json({ success: true, unchanged: true });
  }

  const effectiveDiscount = discountPercent > 0 ? discountPercent : 0;
  const oldPrice = clan.current_price;
  const newPrice = Math.round(clan.base_price * (100 - effectiveDiscount) / 100);
  const announcement = db.prepare("SELECT channel_id FROM price_announcement_channels WHERE guild_id = ?").get(guildId) as
    | { channel_id: string }
    | undefined;
  if (oldPrice !== newPrice && !announcement) {
    return NextResponse.json({ error: "Wähle zuerst im Spawner-Preis-Panel einen Discord-Ankündigungskanal aus." }, { status: 409 });
  }
  let announcementSent = false;
  if (oldPrice !== newPrice && announcement) {
    const channel = db.prepare("SELECT type FROM channels WHERE guild_id = ? AND id = ?").get(guildId, announcement.channel_id) as
      | { type: number }
      | undefined;
    if (!channel || (channel.type !== 0 && channel.type !== 5)) {
      return NextResponse.json({ error: "Der gespeicherte Ankündigungskanal ist nicht mehr verfügbar." }, { status: 409 });
    }
  }

  const updatedAt = new Date().toISOString();
  if (discountPercent === 0) {
    db.prepare("DELETE FROM clan_discounts WHERE guild_id = ? AND role_id = ?").run(guildId, roleId);
  } else {
    db.prepare(`
      INSERT INTO clan_discounts (guild_id, role_id, discount_percent, expires_at, expiry_announced_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?)
      ON CONFLICT(guild_id, role_id) DO UPDATE SET discount_percent = excluded.discount_percent,
        expires_at = excluded.expires_at, expiry_announced_at = NULL, updated_at = excluded.updated_at
    `).run(guildId, roleId, discountPercent, expiration, updatedAt);
  }

  if (oldPrice !== newPrice && announcement) {
    const discountDetails = discountPercent > 0 && expiration
      ? `${discountPercent}% Rabatt bis ${new Date(expiration).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`
      : "Rabatt beendet";
    const content = [
      `**CLAN-BEITRITTSPREIS · ${clan.name}**`,
      `👥 ${clan.member_count} Mitglieder · 🎟️ Platz ${clan.place}`,
      `Preis: ~~${formatWholeAmount(oldPrice)}~~ → **${formatWholeAmount(newPrice)}**`,
      discountDetails,
      `Bezahlt wird an **axxinde**.`,
    ].join("\n");
    try {
      await publishPriceAnnouncement(announcement.channel_id, content);
      announcementSent = true;
    } catch (error) {
      console.error(`Clan-Rabatt für ${guildId}/${roleId} gespeichert, Discord-Meldung fehlgeschlagen:`, error);
      return NextResponse.json({
        error: "Rabatt gespeichert, aber die Discord-Ankündigung konnte nicht gesendet werden.",
        saved: true,
      }, { status: 502 });
    }
  }

  return NextResponse.json({ success: true, announcementSent });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { clanId: roleId } = await params;
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });
  const result = getDb().prepare("DELETE FROM clan_roles WHERE guild_id = ? AND role_id = ?").run(guildId, roleId);
  if (!result.changes) return NextResponse.json({ error: "Clan-Rolle nicht gefunden." }, { status: 404 });
  return NextResponse.json({ success: true });
}
