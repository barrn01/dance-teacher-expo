import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { fulfillOrderByPaymentIntent } from "@/lib/fulfillment";

export const runtime = "nodejs";

// The Stripe webhook is the source of truth for order state. We verify the
// signature against the raw body, then fulfil idempotently. Any thrown error
// returns 500 so Stripe retries.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 },
    );
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (e) {
    console.error("[webhook] signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const result = await fulfillOrderByPaymentIntent(pi.id);
        console.log("[webhook] payment_intent.succeeded", pi.id, result);
        break;
      }
      default:
        // Other events (payment_intent.payment_failed, charge.refunded, …)
        // will be handled as later phases need them.
        break;
    }
  } catch (e) {
    console.error("[webhook] handler error", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
