import { getStripe } from "@/lib/stripe";
import { getConfiguredTiers, getPriceIdForTier, type SubscriptionTier } from "@/lib/stripe-config";

function formatPrice(amount: number, currency: string, interval: "month" | "year"): string {
  const value = amount / 100; // Stripe uses cents
  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  const intervalLabel = interval === "month" ? "/month" : "/year";
  return `${formatted}${intervalLabel}`;
}

/**
 * Fetches current Stripe prices for configured tiers and returns formatted strings (e.g. "€9.00/month").
 * Returns empty object if Stripe is not configured or no prices are set.
 */
export async function getTierPrices(): Promise<Record<number, string>> {
  const stripe = getStripe();
  if (!stripe) return {};

  const tiers = getConfiguredTiers();
  const result: Record<number, string> = {};

  await Promise.all(
    tiers.map(async (tier) => {
      const priceId = getPriceIdForTier(tier as SubscriptionTier);
      if (!priceId) return;
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (!price.recurring || price.unit_amount === null) return;
        const interval = price.recurring.interval as "month" | "year";
        result[tier] = formatPrice(
          price.unit_amount,
          price.currency,
          interval,
        );
      } catch {
        // ignore missing or invalid price
      }
    }),
  );

  return result;
}
