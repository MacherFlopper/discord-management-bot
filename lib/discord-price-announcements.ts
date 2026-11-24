import type { APIEmbed } from "discord.js";

type AnnouncementPayload = string | { embeds: APIEmbed[] };

export async function publishPriceAnnouncement(channelId: string, announcement: AnnouncementPayload) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN fehlt.");

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(typeof announcement === "string" ? { content: announcement } : announcement),
      allowed_mentions: { parse: [] },
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Discord-Preismeldung fehlgeschlagen (HTTP ${response.status}).`);
  }
}
