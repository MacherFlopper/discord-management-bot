export const SPAWNER_DEFAULTS = [
  { key: "skeleton", name: "Skelett", emoji: "<:skellyspawner:1541416789345312808>", buyPrice: 25_500_000, sellPrice: 29_000_000 },
  { key: "creeper", name: "Creeper", emoji: "<:creeperspawner:1541416824615342162>", buyPrice: 18_000_000, sellPrice: 23_000_000 },
  { key: "iron-golem", name: "Eisengolem", emoji: "<:ironspawner:1541416720760311869>", buyPrice: 17_000_000, sellPrice: 23_000_000 },
  { key: "spider", name: "Spinne", emoji: "<:spiderspawner:1541416938469728348>", buyPrice: 4_800_000, sellPrice: 9_000_000 },
  { key: "blaze", name: "Blaze", emoji: "<:blazespawner:1541416865392238592>", buyPrice: 13_400_000, sellPrice: 18_500_000 },
  { key: "cow", name: "Kuh", emoji: "<:cowspawner:1541417015133081600>", buyPrice: 6_000_000, sellPrice: 9_500_000 },
  { key: "piglin", name: "Piglin", emoji: "<:piglinspawner:1541417053301383270>", buyPrice: 8_000_000, sellPrice: 10_600_000 },
] as const;

export function calculateClanPrice(memberCount: number, discountPercent = 0) {
  const place = Math.max(1, Math.floor(memberCount) + 1);
  const pricePerPlace = place <= 5 ? 10_000_000 : 20_000_000;
  const basePrice = place * pricePerPlace;
  const discount = Math.min(99, Math.max(0, Math.floor(discountPercent)));
  return {
    place,
    basePrice,
    currentPrice: Math.round(basePrice * (100 - discount) / 100),
  };
}

export function formatMillions(amount: number) {
  return `${(amount / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}m`;
}

export function formatWholeAmount(amount: number) {
  return amount.toLocaleString("de-DE", { maximumFractionDigits: 0 });
}
