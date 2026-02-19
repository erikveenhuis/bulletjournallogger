/**
 * Maps Stripe Price IDs to account tiers (1–4).
 * Set STRIPE_PRICE_ID_TIER_1 … STRIPE_PRICE_ID_TIER_4 in env (create recurring prices in Stripe Dashboard).
 */
const TIER_ENV_KEYS = [
  "STRIPE_PRICE_ID_TIER_1",
  "STRIPE_PRICE_ID_TIER_2",
  "STRIPE_PRICE_ID_TIER_3",
  "STRIPE_PRICE_ID_TIER_4",
] as const;

export type SubscriptionTier = 1 | 2 | 3 | 4;

const priceIdToTier = new Map<string, SubscriptionTier>();
const tierToPriceId = new Map<SubscriptionTier, string>();

function loadPriceConfig(): void {
  if (priceIdToTier.size > 0) return;
  TIER_ENV_KEYS.forEach((key, index) => {
    const priceId = process.env[key];
    if (priceId) {
      const tier = (index + 1) as SubscriptionTier;
      priceIdToTier.set(priceId, tier);
      tierToPriceId.set(tier, priceId);
    }
  });
}

export function getTierForPriceId(priceId: string): SubscriptionTier | null {
  loadPriceConfig();
  return priceIdToTier.get(priceId) ?? null;
}

export function getPriceIdForTier(tier: SubscriptionTier): string | null {
  loadPriceConfig();
  return tierToPriceId.get(tier) ?? null;
}

export function getConfiguredTiers(): SubscriptionTier[] {
  loadPriceConfig();
  return Array.from(tierToPriceId.keys()).sort((a, b) => a - b);
}

export function isCheckoutEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && getConfiguredTiers().length > 0;
}
