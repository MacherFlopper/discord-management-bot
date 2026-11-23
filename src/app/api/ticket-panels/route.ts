import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "../../../../lib/api-auth";
import { getDb } from "../../../../lib/db";

export async function GET(request: Request) {
  const guildId = new URL(request.url).searchParams.get("guildId");
  const authorization = await authorizeDashboardRequest(request, guildId);
  if (!authorization.ok) return authorization.response;
  if (!guildId) return NextResponse.json([]);
  const panels = getDb().prepare(`
    SELECT ticket_panels.*, panel_channels.name AS panel_channel_name,
      categories.name AS ticket_category_name, roles.name AS support_role_name
    FROM ticket_panels
    LEFT JOIN channels AS panel_channels
      ON panel_channels.guild_id = ticket_panels.guild_id AND panel_channels.id = ticket_panels.panel_channel_id
    LEFT JOIN channels AS categories
      ON categories.guild_id = ticket_panels.guild_id AND categories.id = ticket_panels.ticket_category_id
    LEFT JOIN roles ON roles.guild_id = ticket_panels.guild_id AND roles.id = ticket_panels.support_role_id
    WHERE ticket_panels.guild_id = ? ORDER BY ticket_panels.created_at DESC
  `).all(guildId);
  return NextResponse.json(panels);
}

export async function POST(request: Request) {
  const authorization = await authorizeDashboardRequest(request);
  if (!authorization.ok) return authorization.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const guildId = typeof body.guildId === "string" ? body.guildId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const panelChannelId = typeof body.panelChannelId === "string" ? body.panelChannelId : "";
    const categoryId = typeof body.ticketCategoryId === "string" && body.ticketCategoryId ? body.ticketCategoryId : null;
    const supportRoleId = typeof body.supportRoleId === "string" && body.supportRoleId ? body.supportRoleId : null;
    const buttonLabel = typeof body.buttonLabel === "string" ? body.buttonLabel.trim() : "Ticket erstellen";
    const panelOptions = Array.isArray(body.panelOptions)
      ? body.panelOptions.filter((option): option is { id: string; label: string; style: string } => {
          if (!option || typeof option !== "object") return false;
          const value = option as Record<string, unknown>;
          return typeof value.id === "string" && typeof value.label === "string" && typeof value.style === "string";
        }).slice(0, 5)
      : [{ id: "support", label: buttonLabel, style: "primary" }];
    const questions = Array.isArray(body.questions)
      ? body.questions.filter((question): question is { id: string; label: string; required: boolean } => {
          if (!question || typeof question !== "object") return false;
          const value = question as Record<string, unknown>;
          return typeof value.id === "string" && typeof value.label === "string";
        }).slice(0, 5)
      : [];
    if (!panelOptions.length) panelOptions.push({ id: "support", label: buttonLabel, style: "primary" });
    if (!guildId || name.length < 2 || name.length > 50 || !title || title.length > 100 || description.length > 1500 || !panelChannelId || buttonLabel.length < 1 || buttonLabel.length > 80) {
      return NextResponse.json({ error: "Bitte prüfe Name, Titel, Beschreibung, Ziel-Channel und Button-Text." }, { status: 400 });
    }
    if (!authorization.guildIds.includes(guildId)) {
      return NextResponse.json({ error: "Keine Berechtigung für diesen Discord-Server." }, { status: 403 });
    }

    const db = getDb();
    const target = db.prepare("SELECT id FROM channels WHERE guild_id = ? AND id = ? AND type IN (0, 5)").get(guildId, panelChannelId);
    if (!target) return NextResponse.json({ error: "Der Panel-Channel muss ein synchronisierter Text- oder Ankündigungskanal sein." }, { status: 400 });
    if (categoryId && !db.prepare("SELECT id FROM channels WHERE guild_id = ? AND id = ? AND type = 4").get(guildId, categoryId)) {
      return NextResponse.json({ error: "Die ausgewählte Ticket-Kategorie ist ungültig." }, { status: 400 });
    }
    if (supportRoleId && !db.prepare("SELECT id FROM roles WHERE guild_id = ? AND id = ?").get(guildId, supportRoleId)) {
      return NextResponse.json({ error: "Die ausgewählte Support-Rolle ist ungültig." }, { status: 400 });
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO ticket_panels
        (id, guild_id, name, title, description, panel_channel_id, ticket_category_id, support_role_id, button_label, panel_config_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, guildId, name, title, description, panelChannelId, categoryId, supportRoleId, buttonLabel, JSON.stringify({ panelOptions, questions }), new Date().toISOString());
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticket-Panel konnte nicht gespeichert werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
