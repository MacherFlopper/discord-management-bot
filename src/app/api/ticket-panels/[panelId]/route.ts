import { NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";

type RouteContext = { params: Promise<{ panelId: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  const { panelId } = await params;
  const guildId = new URL(request.url).searchParams.get("guildId");
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });
  const result = getDb().prepare("DELETE FROM ticket_panels WHERE id = ? AND guild_id = ?").run(panelId, guildId);
  if (!result.changes) return NextResponse.json({ error: "Ticket-Panel nicht gefunden." }, { status: 404 });
  return NextResponse.json({ success: true });
}
