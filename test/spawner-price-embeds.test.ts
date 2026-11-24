import assert from "node:assert/strict";
import test from "node:test";
import { createSpawnerPriceChangeEmbed, createSpawnerPriceListEmbed } from "../lib/spawner-price-embeds";
import { SPAWNER_DEFAULTS } from "../lib/pricing";

const prices = SPAWNER_DEFAULTS.map((price) => ({
  name: price.name,
  emoji: price.emoji,
  buy_price: price.buyPrice,
  sell_price: price.sellPrice,
}));

test("spawner price list embed includes the Macher Clan brand and every current price", () => {
  const embed = createSpawnerPriceListEmbed(prices, new Date("2026-11-24T08:00:00.000Z"));

  assert.equal(embed.author?.name, "MACHER CLAN");
  assert.equal(embed.fields?.length, 7);
  assert.match(embed.fields?.[0]?.value || "", /25\.5m/);
  assert.match(embed.fields?.[0]?.value || "", /29m/);
  assert.equal(embed.timestamp, "2026-11-24T08:00:00.000Z");
});

test("spawner price update embed highlights the old and new price", () => {
  const embed = createSpawnerPriceChangeEmbed(
    prices[0],
    { buy_price: 26_000_000, sell_price: prices[0].sell_price },
    new Date("2026-11-24T08:00:00.000Z"),
  );

  assert.equal(embed.author?.name, "MACHER CLAN · PREISUPDATE");
  assert.equal(embed.fields?.[0]?.value, "~~25.5m~~ → **26m**");
  assert.equal(embed.fields?.[1]?.value, "**29m** (unverändert)");
});
