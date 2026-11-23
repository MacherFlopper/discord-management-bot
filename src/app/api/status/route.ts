import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export async function GET() {
  const db = getDb();
  const guildCount = (db.prepare("SELECT COUNT(*) AS count FROM guilds").get() as { count: number }).count;
  const ticketCount = (db.prepare("SELECT COUNT(*) AS count FROM tickets").get() as { count: number }).count;
  const memberCount = (db.prepare("SELECT COUNT(*) AS count FROM members").get() as { count: number }).count;
  const logCount = (db.prepare("SELECT COUNT(*) AS count FROM logs").get() as { count: number }).count;
  const clanCount = (db.prepare("SELECT COUNT(*) AS count FROM clan_roles").get() as { count: number }).count;
  const botStatus = db.prepare("SELECT state, bot_name, guild_count, last_seen_at FROM bot_status WHERE id = 1").get() as
    | { state: string; bot_name: string | null; guild_count: number; last_seen_at: string }
    | undefined;
  const lastSeen = botStatus ? Date.parse(botStatus.last_seen_at) : 0;
  const botOnline = botStatus?.state === "online" && Date.now() - lastSeen < 60_000;
  const firstDay = new Date();
  firstDay.setUTCHours(0, 0, 0, 0);
  firstDay.setUTCDate(firstDay.getUTCDate() - 6);
  const activityRows = db.prepare(`
    SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
    FROM logs WHERE created_at >= ? GROUP BY day
  `).all(firstDay.toISOString()) as { day: string; count: number }[];
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
    botGuildCount: botStatus?.guild_count || 0,
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
