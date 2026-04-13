/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler. No auth — verified via Stripe signature.
 */
import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent, handleWebhook } from "@/lib/billing";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  try {
    const rawBody = await req.text();
    const event = constructWebhookEvent(rawBody, signature);
    await handleWebhook(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("Stripe webhook error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
