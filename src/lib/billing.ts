/**
 * Stripe billing utilities.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_PRO
 */
import Stripe from "stripe";
import { db } from "./db";
import { tenants } from "./db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro: process.env.STRIPE_PRICE_PRO,
};

/**
 * Create a Stripe Checkout session for upgrading to a paid plan.
 */
export async function createCheckoutSession(
  tenantId: string,
  plan: "growth" | "pro",
  returnUrl: string
) {
  const stripe = getStripe();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new Error("Tenant not found");

  const priceId = PLAN_PRICE_MAP[plan];
  if (!priceId) throw new Error(`No price configured for plan: ${plan}`);

  // Create or reuse Stripe customer
  let customerId = tenant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { tenantId },
    });
    customerId = customer.id;
    await db
      .update(tenants)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?billing=success`,
    cancel_url: `${returnUrl}?billing=cancelled`,
    metadata: { tenantId, plan },
  });

  return session;
}

/**
 * Create a Stripe Billing Portal session.
 */
export async function createPortalSession(
  tenantId: string,
  returnUrl: string
) {
  const stripe = getStripe();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant?.stripeCustomerId) {
    throw new Error("No Stripe customer for this tenant");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });

  return session;
}

/**
 * Process Stripe webhook events.
 */
export async function handleWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const plan = session.metadata?.plan;
      if (tenantId && plan) {
        await db
          .update(tenants)
          .set({
            plan: plan as "starter" | "growth" | "pro",
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId));
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.stripeCustomerId, customerId))
        .limit(1);

      if (tenant) {
        // Determine plan from price
        const priceId = subscription.items.data[0]?.price?.id;
        let plan: "starter" | "growth" | "pro" = "starter";
        if (priceId === process.env.STRIPE_PRICE_PRO) plan = "pro";
        else if (priceId === process.env.STRIPE_PRICE_GROWTH) plan = "growth";

        await db
          .update(tenants)
          .set({
            plan,
            stripeSubscriptionId: subscription.id,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenant.id));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      await db
        .update(tenants)
        .set({
          plan: "starter",
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(tenants.stripeCustomerId, customerId));
      break;
    }
  }
}

/**
 * Construct and verify a Stripe webhook event from raw body.
 */
export function constructWebhookEvent(
  rawBody: string | Buffer,
  signature: string
) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
