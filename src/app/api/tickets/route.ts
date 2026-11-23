import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId && !authorization.guildIds.length) return NextResponse.json([]);

  const db = getDb();
  const rows = guildId
    ? db.prepare("SELECT * FROM tickets WHERE guild_id = ? ORDER BY updated_at DESC").all(guildId)
    : db.prepare(`SELECT * FROM tickets WHERE guild_id IN (${authorization.guildIds.map(() => "?").join(",")}) ORDER BY updated_at DESC`).all(...authorization.guildIds);
  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;

  try {
    const body = await request.json() as { ticketId?: unknown; guildId?: unknown; status?: unknown };
    const ticketId = typeof body.ticketId === "string" ? body.ticketId : "";
    const guildId = typeof body.guildId === "string" ? body.guildId : "";
    const status = typeof body.status === "string" ? body.status : "";
    if (!ticketId || !guildId) return NextResponse.json({ error: "Ticket oder Server fehlt." }, { status: 400 });
    if (!authorization.guildIds.includes(guildId)) return NextResponse.json({ error: "Keine Berechtigung für diesen Discord-Server." }, { status: 403 });
    if (!["open", "in_progress", "waiting", "closed"].includes(status)) return NextResponse.json({ error: "Ungültiger Ticket-Status." }, { status: 400 });

    const db = getDb();
    const result = db.prepare("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ? AND guild_id = ?")
      .run(status, new Date().toISOString(), ticketId, guildId);
    if (result.changes === 0) return NextResponse.json({ error: "Ticket nicht gefunden." }, { status: 404 });

    db.prepare(`
      INSERT INTO logs (guild_id, event_type, actor_id, details, channel_id, created_at)
      VALUES (?, 'ticket_status_changed', NULL, ?, NULL, ?)
    `).run(guildId, `${ticketId}:${status}`, new Date().toISOString());
    return NextResponse.json({ success: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticket konnte nicht aktualisiert werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
