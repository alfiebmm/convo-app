import { test } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";

import {
  buildInvoiceTenantUpdate,
  buildSubscriptionTenantUpdate,
  getBillingPriceLookup,
  resolveBillingPrice,
} from "../billing";

const env = {
  STRIPE_PRICE_STARTER: "price_starter_month",
  STRIPE_PRICE_GROWTH: "price_growth_month",
  STRIPE_PRICE_SCALE: "price_scale_month",
  STRIPE_PRICE_STARTER_ANNUAL: "price_starter_year",
  STRIPE_PRICE_GROWTH_ANNUAL: "price_growth_year",
  STRIPE_PRICE_SCALE_ANNUAL: "price_scale_year",
};

test("getBillingPriceLookup maps all six Stripe prices to plan and interval", () => {
  assert.deepEqual(getBillingPriceLookup(env), {
    price_starter_month: { plan: "starter", interval: "month" },
    price_growth_month: { plan: "growth", interval: "month" },
    price_scale_month: { plan: "scale", interval: "month" },
    price_starter_year: { plan: "starter", interval: "year" },
    price_growth_year: { plan: "growth", interval: "year" },
    price_scale_year: { plan: "scale", interval: "year" },
  });
});

test("resolveBillingPrice returns null for unknown price IDs", () => {
  assert.deepEqual(resolveBillingPrice("price_growth_year", env), {
    plan: "growth",
    interval: "year",
  });
  assert.equal(resolveBillingPrice("price_unknown", env), null);
});

test("buildSubscriptionTenantUpdate derives plan, status, and period end", () => {
  const update = buildSubscriptionTenantUpdate(
    subscription({
      status: "trialing",
      priceId: "price_scale_year",
      currentPeriodEnd: 1_800_000_000,
    }),
    env
  );

  assert.equal(update.plan, "scale");
  assert.equal(update.interval, "year");
  assert.equal(update.stripeSubscriptionId, "sub_test");
  assert.equal(update.subscriptionStatus, "trialing");
  assert.equal(
    update.subscriptionCurrentPeriodEnd?.toISOString(),
    "2027-01-15T08:00:00.000Z"
  );
});

test("buildSubscriptionTenantUpdate normalises unsupported Stripe statuses to incomplete", () => {
  const update = buildSubscriptionTenantUpdate(
    subscription({
      status: "paused" as Stripe.Subscription.Status,
      priceId: "price_growth_month",
    }),
    env
  );

  assert.equal(update.plan, "growth");
  assert.equal(update.interval, "month");
  assert.equal(update.subscriptionStatus, "incomplete");
});

test("buildInvoiceTenantUpdate marks successful invoice payments active", () => {
  const update = buildInvoiceTenantUpdate(
    invoice({
      priceId: "price_starter_year",
      periodEnd: 1_900_000_000,
    }),
    "active",
    env
  );

  assert.equal(update.plan, "starter");
  assert.equal(update.interval, "year");
  assert.equal(update.stripeSubscriptionId, "sub_test");
  assert.equal(update.subscriptionStatus, "active");
  assert.equal(
    update.subscriptionCurrentPeriodEnd?.toISOString(),
    "2030-03-17T17:46:40.000Z"
  );
});

test("buildInvoiceTenantUpdate marks failed invoice payments past_due", () => {
  const update = buildInvoiceTenantUpdate(
    invoice({
      priceId: "price_growth_month",
      periodEnd: 1_900_000_000,
    }),
    "past_due",
    env
  );

  assert.equal(update.plan, "growth");
  assert.equal(update.interval, "month");
  assert.equal(update.subscriptionStatus, "past_due");
});

function subscription(args: {
  status: Stripe.Subscription.Status;
  priceId: string;
  currentPeriodEnd?: number;
}): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    status: args.status,
    current_period_end: args.currentPeriodEnd,
    items: {
      object: "list",
      data: [
        {
          id: "si_test",
          object: "subscription_item",
          price: { id: args.priceId, object: "price" },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

function invoice(args: {
  priceId: string;
  periodEnd?: number;
}): Stripe.Invoice {
  return {
    id: "in_test",
    object: "invoice",
    customer: "cus_test",
    subscription: "sub_test",
    lines: {
      object: "list",
      data: [
        {
          id: "il_test",
          object: "line_item",
          price: { id: args.priceId, object: "price" },
          period: { start: 1_800_000_000, end: args.periodEnd },
        },
      ],
    },
  } as unknown as Stripe.Invoice;
}
