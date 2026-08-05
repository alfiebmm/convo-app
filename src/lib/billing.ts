/**
 * Stripe billing utilities.
 *
 * Environment variables:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_GROWTH, STRIPE_PRICE_SCALE,
 *   STRIPE_PRICE_STARTER_ANNUAL, STRIPE_PRICE_GROWTH_ANNUAL,
 *   STRIPE_PRICE_SCALE_ANNUAL
 */
import Stripe from "stripe";
import { db } from "./db";
import { tenants } from "./db/schema";
import { eq } from "drizzle-orm";

export type BillingPlan = "starter" | "growth" | "scale";
export type BillingInterval = "month" | "year";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

type BillingPriceDetails = {
  plan: BillingPlan;
  interval: BillingInterval;
};

type PriceEnv = Record<string, string | undefined>;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export function getBillingPriceLookup(
  env: PriceEnv = process.env
): Record<string, BillingPriceDetails> {
  const entries: Array<[string | undefined, BillingPriceDetails]> = [
    [env.STRIPE_PRICE_STARTER, { plan: "starter", interval: "month" }],
    [env.STRIPE_PRICE_GROWTH, { plan: "growth", interval: "month" }],
    [env.STRIPE_PRICE_SCALE, { plan: "scale", interval: "month" }],
    [env.STRIPE_PRICE_STARTER_ANNUAL, { plan: "starter", interval: "year" }],
    [env.STRIPE_PRICE_GROWTH_ANNUAL, { plan: "growth", interval: "year" }],
    [env.STRIPE_PRICE_SCALE_ANNUAL, { plan: "scale", interval: "year" }],
  ];

  return Object.fromEntries(
    entries.filter((entry): entry is [string, BillingPriceDetails] =>
      Boolean(entry[0])
    )
  );
}

export function resolveBillingPrice(
  priceId: string,
  env: PriceEnv = process.env
): BillingPriceDetails | null {
  return getBillingPriceLookup(env)[priceId] ?? null;
}

function getCheckoutPriceId(
  plan: BillingPlan,
  interval: BillingInterval,
  env: PriceEnv = process.env
) {
  const lookup = getBillingPriceLookup(env);
  const found = Object.entries(lookup).find(
    ([, details]) => details.plan === plan && details.interval === interval
  );
  return found?.[0];
}

function normaliseSubscriptionStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  if (
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete"
  ) {
    return status;
  }

  return "incomplete";
}

function timestampFromSeconds(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription) {
  return (subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  }).current_period_end;
}

function getInvoiceLinePriceId(line: Stripe.InvoiceLineItem | undefined) {
  const lineWithLegacyPrice = line as
    | (Stripe.InvoiceLineItem & {
        price?: { id?: string | null } | null;
        pricing?: {
          price_details?: { price?: string | null } | null;
        } | null;
      })
    | undefined;

  return (
    lineWithLegacyPrice?.price?.id ??
    lineWithLegacyPrice?.pricing?.price_details?.price ??
    null
  );
}

export function buildSubscriptionTenantUpdate(
  subscription: Stripe.Subscription,
  env: PriceEnv = process.env
) {
  const priceId = subscription.items.data[0]?.price?.id;
  const details = priceId ? resolveBillingPrice(priceId, env) : null;

  return {
    plan: details?.plan,
    interval: details?.interval,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: normaliseSubscriptionStatus(subscription.status),
    subscriptionCurrentPeriodEnd: timestampFromSeconds(
      getSubscriptionCurrentPeriodEnd(subscription)
    ),
  };
}

export function buildInvoiceTenantUpdate(
  invoice: Stripe.Invoice,
  status: Extract<SubscriptionStatus, "active" | "past_due">,
  env: PriceEnv = process.env
) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscription = invoiceWithSubscription.subscription;
  const firstLine = invoice.lines.data[0];
  const priceId = getInvoiceLinePriceId(firstLine);
  const details = priceId ? resolveBillingPrice(priceId, env) : null;
  const periodEnd = firstLine?.period?.end;

  return {
    plan: details?.plan,
    interval: details?.interval,
    stripeSubscriptionId:
      typeof subscription === "string" ? subscription : subscription?.id,
    subscriptionStatus: status,
    subscriptionCurrentPeriodEnd: timestampFromSeconds(periodEnd),
  };
}

/**
 * Create a Stripe Checkout session for upgrading to a paid plan.
 */
export async function createCheckoutSession(
  tenantId: string,
  plan: BillingPlan,
  interval: BillingInterval,
  returnUrl: string,
  options: { trialPeriodDays?: number } = {}
) {
  const stripe = getStripe();

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) throw new Error("Tenant not found");

  const priceId = getCheckoutPriceId(plan, interval);
  if (!priceId) {
    throw new Error(`No price configured for plan: ${plan}/${interval}`);
  }

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
    subscription_data: options.trialPeriodDays
      ? { trial_period_days: options.trialPeriodDays }
      : undefined,
    success_url: `${returnUrl}?billing=success`,
    cancel_url: `${returnUrl}?billing=cancelled`,
    metadata: { tenantId, plan, interval },
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
            plan: plan as BillingPlan,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId));
      }
      break;
    }

    case "customer.subscription.created":
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
        const update = buildSubscriptionTenantUpdate(subscription);

        await db
          .update(tenants)
          .set({
            ...(update.plan ? { plan: update.plan } : {}),
            stripeSubscriptionId: update.stripeSubscriptionId,
            subscriptionStatus: update.subscriptionStatus,
            subscriptionCurrentPeriodEnd: update.subscriptionCurrentPeriodEnd,
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
          stripeSubscriptionId: null,
          subscriptionStatus: "canceled",
          subscriptionCurrentPeriodEnd: timestampFromSeconds(
            getSubscriptionCurrentPeriodEnd(subscription)
          ),
          updatedAt: new Date(),
        })
        .where(eq(tenants.stripeCustomerId, customerId));
      break;
    }

    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;
      if (!customerId) break;

      const update = buildInvoiceTenantUpdate(
        invoice,
        event.type === "invoice.payment_succeeded" ? "active" : "past_due"
      );

      await db
        .update(tenants)
        .set({
          ...(update.plan ? { plan: update.plan } : {}),
          ...(update.stripeSubscriptionId
            ? { stripeSubscriptionId: update.stripeSubscriptionId }
            : {}),
          subscriptionStatus: update.subscriptionStatus,
          ...(update.subscriptionCurrentPeriodEnd
            ? {
                subscriptionCurrentPeriodEnd:
                  update.subscriptionCurrentPeriodEnd,
              }
            : {}),
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
