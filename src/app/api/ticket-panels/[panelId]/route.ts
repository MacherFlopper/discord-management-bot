import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../../lib/api-auth";
import { getDb } from "../../../../../lib/db";

type RouteContext = { params: Promise<{ panelId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { panelId } = await params;
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });

  const db = getDb();
  const panel = db.prepare("SELECT * FROM ticket_panels WHERE id = ? AND guild_id = ?").get(panelId, guildId) as
    | { id: string; name: string; title: string; description: string; panel_channel_id: string; button_label: string; panel_config_json: string }
    | undefined;
  if (!panel) return NextResponse.json({ error: "Ticket-Panel nicht gefunden." }, { status: 404 });

  const token = process.env.DISCORD_TOKEN;
  if (!token) return NextResponse.json({ error: "DISCORD_TOKEN ist nicht konfiguriert." }, { status: 500 });

  let config: { panelOptions?: { id: string; label: string; style: string }[] } = {};
  try { config = JSON.parse(panel.panel_config_json || "{}"); } catch { config = {}; }
  const options = config.panelOptions?.length
    ? config.panelOptions
    : [{ id: "support", label: panel.button_label || "Ticket erstellen", style: "primary" }];

  const styles: Record<string, number> = { primary: 1, secondary: 2, success: 3, danger: 4 };
  const components = [{
    type: 1,
    components: options.slice(0, 5).map((option) => ({
      type: 2,
      style: styles[option.style] || 1,
      custom_id: `ticket:open:${panel.id}:${option.id}`,
      label: option.label.slice(0, 80),
    })),
  }];

  const response = await fetch(`https://discord.com/api/v10/channels/${panel.panel_channel_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        color: 0x8057e8,
        title: panel.title,
        description: panel.description || `Erstelle ein Ticket für **${panel.name}**.`,
      }],
      components,
    }),
  });
  if (!response.ok) {
    const discordError = await response.text();
    return NextResponse.json({ error: `Discord hat die Nachricht abgelehnt (${response.status}).`, discordError }, { status: 502 });
  }

  const message = await response.json() as { id: string };
  db.prepare(`INSERT INTO logs (guild_id, event_type, actor_id, details, channel_id, created_at) VALUES (?, 'ticket_panel_published', NULL, ?, ?, ?)`).run(guildId, `[${panel.name}] ${message.id}`, panel.panel_channel_id, new Date().toISOString());
  return NextResponse.json({ success: true, messageId: message.id });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { panelId } = await params;
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json({ error: "Server-ID fehlt." }, { status: 400 });
  const result = getDb().prepare("DELETE FROM ticket_panels WHERE id = ? AND guild_id = ?").run(panelId, guildId);
  if (!result.changes) return NextResponse.json({ error: "Ticket-Panel nicht gefunden." }, { status: 404 });
  return NextResponse.json({ success: true });
}
