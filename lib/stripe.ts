import Stripe from "stripe";

function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY;
}

let stripeInstance: Stripe | null = null;

/**
 * Server-side Stripe client. Returns null if STRIPE_SECRET_KEY is not set.
 */
export function getStripe(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;
  if (!stripeInstance) {
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

export function isStripeConfigured(): boolean {
  return !!getStripeSecretKey();
}
