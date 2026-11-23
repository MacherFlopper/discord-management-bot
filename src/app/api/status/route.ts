import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;
  const db = getDb();
  const guildIds = authorization.guildIds;
  const placeholders = guildIds.map(() => "?").join(",");
  const count = (table: "tickets" | "members" | "logs" | "clan_roles") => guildIds.length
    ? (db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE guild_id IN (${placeholders})`).get(...guildIds) as { count: number }).count
    : 0;
  const guildCount = guildIds.length
    ? (db.prepare(`SELECT COUNT(*) AS count FROM guilds WHERE id IN (${placeholders})`).get(...guildIds) as { count: number }).count
    : 0;
  const ticketCount = count("tickets");
  const memberCount = count("members");
  const logCount = count("logs");
  const clanCount = count("clan_roles");
  const botStatus = db.prepare("SELECT state, bot_name, guild_count, last_seen_at FROM bot_status WHERE id = 1").get() as
    | { state: string; bot_name: string | null; guild_count: number; last_seen_at: string }
    | undefined;
  const lastSeen = botStatus ? Date.parse(botStatus.last_seen_at) : 0;
  const botOnline = botStatus?.state === "online" && Date.now() - lastSeen < 60_000;
  const firstDay = new Date();
  firstDay.setUTCHours(0, 0, 0, 0);
  firstDay.setUTCDate(firstDay.getUTCDate() - 6);
  const activityRows = guildIds.length
    ? db.prepare(`
        SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
        FROM logs WHERE created_at >= ? AND guild_id IN (${placeholders}) GROUP BY day
      `).all(firstDay.toISOString(), ...guildIds) as { day: string; count: number }[]
    : [];
  const activityByDay = new Map(activityRows.map((row) => [row.day, row.count]));
  const activity = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(firstDay);
    day.setUTCDate(day.getUTCDate() + index);
    const key = day.toISOString().slice(0, 10);
    return { day: key, count: activityByDay.get(key) || 0 };
  });

  return NextResponse.json({
    configured: Boolean(process.env.DISCORD_TOKEN),
    botOnline,
    botState: botOnline ? "online" : botStatus?.state || "offline",
    botGuildCount: guildCount,
    botName: botStatus?.bot_name || null,
    lastSeenAt: botStatus?.last_seen_at || null,
    database: "connected",
    guildCount,
    memberCount,
    ticketCount,
    logCount,
    clanCount,
    activity,
  });
}
