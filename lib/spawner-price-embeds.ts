import type { APIEmbed } from "discord.js";
import { formatMillions } from "./pricing";

type SpawnerPriceSummary = {
  name: string;
  emoji: string;
  buy_price: number;
  sell_price: number;
};

export function createSpawnerPriceListEmbed(prices: SpawnerPriceSummary[], publishedAt = new Date()): APIEmbed {
  return {
    author: { name: "MACHER CLAN" },
    title: "Spawner · An- und Verkauf",
    description: "Die aktuelle Preisliste auf einen Blick.",
    color: 0x8057e8,
    fields: prices.map((price) => ({
      name: `${price.emoji} ${price.name}`,
      value: `🟢 **Wir kaufen** · **${formatMillions(price.buy_price)}**\n🔵 **Wir verkaufen** · **${formatMillions(price.sell_price)}**`,
      inline: true,
    })),
    footer: { text: "MACHER CLAN · Preise in Spielwährung" },
    timestamp: publishedAt.toISOString(),
  };
}

export function createSpawnerPriceChangeEmbed(
  previous: SpawnerPriceSummary,
  next: Pick<SpawnerPriceSummary, "buy_price" | "sell_price">,
  changedAt = new Date(),
): APIEmbed {
  const displayChange = (oldPrice: number, newPrice: number) => oldPrice === newPrice
    ? `**${formatMillions(newPrice)}** (unverändert)`
    : `~~${formatMillions(oldPrice)}~~ → **${formatMillions(newPrice)}**`;

  return {
    author: { name: "MACHER CLAN · PREISUPDATE" },
    title: `${previous.emoji} ${previous.name}`,
    description: "Ein Spawner-Preis wurde aktualisiert.",
    color: 0xf0a33a,
    fields: [
      { name: "🟢 Wir kaufen", value: displayChange(previous.buy_price, next.buy_price), inline: true },
      { name: "🔵 Wir verkaufen", value: displayChange(previous.sell_price, next.sell_price), inline: true },
    ],
    footer: { text: "Die vollständige aktuelle Preisliste folgt." },
    timestamp: changedAt.toISOString(),
  };
}
