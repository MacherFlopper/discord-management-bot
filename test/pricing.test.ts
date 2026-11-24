import assert from "node:assert/strict";
import test from "node:test";
import { calculateClanPrice, formatMillions, formatWholeAmount, SPAWNER_DEFAULTS } from "../lib/pricing";

test("clan entry prices use the next place and switch rates after place five", () => {
  const examples = [
    { members: 4, place: 5, price: 50_000_000 },
    { members: 5, place: 6, price: 120_000_000 },
    { members: 15, place: 16, price: 320_000_000 },
    { members: 26, place: 27, price: 540_000_000 },
    { members: 14, place: 15, price: 300_000_000 },
    { members: 13, place: 14, price: 280_000_000 },
    { members: 9, place: 10, price: 200_000_000 },
    { members: 7, place: 8, price: 160_000_000 },
  ];
  for (const example of examples) {
    assert.deepEqual(calculateClanPrice(example.members), {
      place: example.place,
      basePrice: example.price,
      currentPrice: example.price,
    });
  }
});

test("clan discounts are applied to the calculated price", () => {
  assert.deepEqual(calculateClanPrice(10, 50), {
    place: 11,
    basePrice: 220_000_000,
    currentPrice: 110_000_000,
  });
  assert.equal(formatWholeAmount(320_000_000), "320.000.000");
});

test("spawner prices match the supplied starting list", () => {
  assert.deepEqual(SPAWNER_DEFAULTS.map(({ name, buyPrice, sellPrice }) => [name, buyPrice, sellPrice]), [
    ["Skelett", 25_500_000, 29_000_000],
    ["Creeper", 18_000_000, 23_000_000],
    ["Eisengolem", 17_000_000, 23_000_000],
    ["Spinne", 4_800_000, 9_000_000],
    ["Blaze", 13_400_000, 18_500_000],
    ["Kuh", 6_000_000, 9_500_000],
    ["Piglin", 8_000_000, 10_600_000],
  ]);
  assert.equal(formatMillions(25_500_000), "25.5m");
});
