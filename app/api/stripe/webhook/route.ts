import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getTierForPriceId } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe or webhook secret not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
    const userId = subscription.metadata?.user_id;

    if (!customerId) {
      return NextResponse.json({ received: true });
    }

    let tier: number | null = null;
    if (subscription.items?.data?.[0]?.price?.id) {
      tier = getTierForPriceId(subscription.items.data[0].price.id);
    }

    const updates: { account_tier: number; stripe_customer_id: string; stripe_subscription_id: string } = {
      account_tier: tier ?? 0,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
    };

    if (userId) {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);
      if (error) {
        console.error("[Stripe webhook] profile update by user_id:", error);
      }
    } else {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("stripe_customer_id", customerId);
      if (error) {
        console.error("[Stripe webhook] profile update by stripe_customer_id:", error);
      }
    }
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

    if (customerId) {
      await supabase
        .from("profiles")
        .update({
          account_tier: 0,
          stripe_subscription_id: null,
        })
        .eq("stripe_subscription_id", subscription.id);
    }
  }

  return NextResponse.json({ received: true });
}
