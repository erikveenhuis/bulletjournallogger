import { NextResponse } from "next/server";
import { getEffectiveUser, getEffectiveSupabaseClient } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPriceIdForTier, type SubscriptionTier } from "@/lib/stripe-config";

const VALID_TIERS: SubscriptionTier[] = [1, 2, 3, 4];

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const { user } = await getEffectiveUser();
  if (!user || typeof user.email !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tier = typeof body.tier === "number" ? body.tier : undefined;

  if (tier === undefined || !VALID_TIERS.includes(tier as SubscriptionTier)) {
    return NextResponse.json(
      { error: "tier must be 1, 2, 3, or 4" },
      { status: 400 },
    );
  }

  const priceId = getPriceIdForTier(tier as SubscriptionTier);
  if (!priceId) {
    return NextResponse.json(
      { error: `Price not configured for tier ${tier}` },
      { status: 400 },
    );
  }

  const supabase = await getEffectiveSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "http://localhost:3000";

  const sessionParams: {
    mode: "subscription";
    line_items: Array<{ price: string; quantity: number }>;
    success_url: string;
    cancel_url: string;
    client_reference_id: string;
    subscription_data: { metadata: { user_id: string } };
    customer?: string;
    customer_email?: string;
    discounts?: Array<{ coupon: string }>;
    payment_method_collection?: "always" | "if_required";
  } = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/profile/account?upgraded=1`,
    cancel_url: `${baseUrl}/profile/account`,
    client_reference_id: user.id,
    subscription_data: { metadata: { user_id: user.id } },
  };

  // Auto-apply test coupon if configured (for 100% off testing)
  const testCouponId = process.env.STRIPE_TEST_COUPON_ID;
  if (testCouponId) {
    sessionParams.discounts = [{ coupon: testCouponId }];
    // When total is €0, skip asking for card/Klarna
    sessionParams.payment_method_collection = "if_required";
  }

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: session.url });
}
