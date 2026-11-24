import { getDb } from "./db";
import { SPAWNER_DEFAULTS } from "./pricing";

export type SpawnerPrice = {
  guild_id: string;
  spawner_key: string;
  name: string;
  emoji: string;
  buy_price: number;
  sell_price: number;
  sort_order: number;
  updated_at: string;
};

export function ensureSpawnerPrices(guildId: string) {
  const db = getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO spawner_prices
      (guild_id, spawner_key, name, emoji, buy_price, sell_price, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const timestamp = new Date().toISOString();
  for (const [index, spawner] of SPAWNER_DEFAULTS.entries()) {
    insert.run(guildId, spawner.key, spawner.name, spawner.emoji, spawner.buyPrice, spawner.sellPrice, index, timestamp);
  }
  return db.prepare("SELECT * FROM spawner_prices WHERE guild_id = ? ORDER BY sort_order").all(guildId) as SpawnerPrice[];
}
