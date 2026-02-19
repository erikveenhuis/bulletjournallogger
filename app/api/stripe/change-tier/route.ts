import { NextResponse } from "next/server";
import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPriceIdForTier, type SubscriptionTier } from "@/lib/stripe-config";

const VALID_TIERS = [0, 1, 2, 3, 4] as const;

type ProfileStripeData = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  account_tier: number | null;
};

async function resolveSubscriptionId(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  profile: ProfileStripeData,
): Promise<string | null> {
  if (profile.stripe_subscription_id) return profile.stripe_subscription_id;
  if (!profile.stripe_customer_id) return null;

  const subscriptions = await stripe.subscriptions.list({
    customer: profile.stripe_customer_id,
    status: "all",
    limit: 10,
  });

  const activeLike = subscriptions.data.find(
    (sub) => sub.status !== "canceled" && sub.status !== "incomplete_expired",
  );

  return activeLike?.id ?? null;
}

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const { user } = await getEffectiveUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tier = typeof body.tier === "number" ? body.tier : undefined;

  if (tier === undefined || !VALID_TIERS.includes(tier as (typeof VALID_TIERS)[number])) {
    return NextResponse.json(
      { error: "tier must be 0, 1, 2, 3, or 4" },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const supabase = await getEffectiveSupabaseClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, account_tier")
    .eq("user_id", user.id)
    .maybeSingle<ProfileStripeData>();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  const currentTier = typeof profile?.account_tier === "number" ? profile.account_tier : 0;

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const subscriptionId = await resolveSubscriptionId(stripe, profile);
  if (!subscriptionId) {
    if (tier > 0) {
      return NextResponse.json(
        { error: "No active subscription found. Use checkout to start a paid plan." },
        { status: 400 },
      );
    }
    await supabase
      .from("profiles")
      .update({ account_tier: tier, stripe_subscription_id: null })
      .eq("user_id", user.id);
    return NextResponse.json({ success: true, tier });
  }

  if (tier === 0) {
    await stripe.subscriptions.cancel(subscriptionId);
    await supabase
      .from("profiles")
      .update({ account_tier: 0, stripe_subscription_id: null })
      .eq("user_id", user.id);
    return NextResponse.json({ success: true, tier: 0 });
  }

  const priceId = getPriceIdForTier(tier as SubscriptionTier);
  if (!priceId) {
    return NextResponse.json(
      { error: `Price not configured for tier ${tier}` },
      { status: 400 },
    );
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionItemId = subscription.items.data[0]?.id;

  if (!subscriptionItemId) {
    return NextResponse.json({ error: "Subscription item not found" }, { status: 400 });
  }

  const updated = await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: subscriptionItemId, price: priceId }],
    proration_behavior: "create_prorations",
  });

  await supabase
    .from("profiles")
    .update({
      account_tier: tier,
      stripe_subscription_id: updated.id,
    })
    .eq("user_id", user.id);

  return NextResponse.json({ success: true, tier });
}

