export const PACKS = Object.freeze({
  copper_10: Object.freeze({
    key: "copper_10",
    priceEnv: "STRIPE_PRICE_COPPER_10",
    mode: "payment",
    credits: 10,
    coinType: "copper",
    label: "10 copper pennies"
  }),
  moon_30: Object.freeze({
    key: "moon_30",
    priceEnv: "STRIPE_PRICE_MOON_30",
    mode: "payment",
    credits: 30,
    coinType: "moon",
    label: "30 moon pennies"
  }),
  keeper_monthly: Object.freeze({
    key: "keeper_monthly",
    priceEnv: "STRIPE_PRICE_KEEPER_MONTHLY",
    mode: "subscription",
    credits: 90,
    coinType: "moon",
    label: "Well Keeper"
  })
});

export function getPack(packKey) {
  return PACKS[String(packKey || "")] || null;
}

export function expectedPriceId(pack) {
  return pack ? process.env[pack.priceEnv] || "" : "";
}

export function normalizeCoinType(value, fallback = "copper") {
  return value === "moon" ? "moon" : value === "daily" ? "daily" : value === "copper" ? "copper" : fallback;
}
