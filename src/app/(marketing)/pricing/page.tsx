import Link from "next/link";
import { CTASection, MarketingLayout } from "@/components/marketing/marketing-layout";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Convo Pricing for AI Chat, Leads, and SEO Content",
  description:
    "Choose a Convo plan for website chat, lead capture, SEO content, CMS publishing, and performance tracking.",
  path: "/pricing",
  keywords: [
    "AI chatbot pricing",
    "SEO content automation pricing",
    "lead capture chatbot pricing",
    "website chatbot pricing",
    "Convo pricing",
  ],
});

const plans = [
  {
    name: "Starter",
    price: "$99",
    annualPrice: null,
    period: "/mo",
    description: "Start turning visitor questions into leads and content ideas.",
    badge: null,
    features: [
      "1 website",
      "AI website chat",
      "Configurable lead capture",
      "SEO-optimised content queue",
      "Basic performance tracking",
    ],
  },
  {
    name: "Growth",
    price: "$249",
    annualPrice: "$224",
    period: "/mo",
    description: "For active SMBs ready to publish and measure content.",
    badge: "Most popular",
    features: [
      "Higher chat and content limits",
      "Advanced lead capture controls",
      "WordPress, Shopify, Webflow, and REST publishing",
      "GSC, GA4, and Ahrefs-style SEO inputs",
      "Content performance tracking",
    ],
  },
  {
    name: "Scale",
    price: "$499+",
    annualPrice: "$449+",
    period: "/mo",
    description: "For agencies, marketplaces, and multi-site growth teams.",
    badge: "Demo-led",
    features: [
      "Multiple websites",
      "Advanced guardrails and workflows",
      "API and webhook options",
      "Priority onboarding",
      "Strategic content and performance reviews",
    ],
  },
] as const;

const comparisons = [
  ["Website chat", "Included", "Included", "Included"],
  ["Lead capture", "Included", "Advanced", "Advanced"],
  ["SEO content", "Basic queue", "Full workflow", "Multi-site workflow"],
  ["CMS publishing", "Manual export", "Included", "Included"],
  ["SEO data", "Basic", "GSC, GA4, Ahrefs-style inputs", "Advanced reporting"],
  ["Onboarding", "Self-serve", "Demo-led", "Dedicated"],
] as const;

export default function PricingPage() {
  return (
    <MarketingLayout>
      <main>
        <section className="bg-zinc-950 text-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Pricing
              </p>
              <h1 className="font-display text-5xl font-extrabold leading-tight tracking-normal sm:text-6xl">
                Chat, leads, and SEO content in one growth loop.
              </h1>
              <p className="mt-6 text-lg leading-8 text-zinc-300">
                Convo replaces separate tools for website chat, lead capture,
                content briefs, CMS publishing, and content performance
                tracking. Start self-serve, then use a demo to tune the setup
                for your business.
              </p>
              <div className="mt-8 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 p-1 text-sm font-semibold text-orange-100">
                <span className="rounded-full bg-[var(--convo-orange)] px-4 py-2 text-white">
                  Monthly
                </span>
                <span className="px-4 py-2">Annual saves 10% on Growth and Scale</span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="grid gap-5 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                    plan.badge === "Most popular"
                      ? "border-[var(--convo-orange)] shadow-orange-100"
                      : "border-zinc-200"
                  }`}
                >
                  {plan.badge ? (
                    <div className="absolute right-5 top-5 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--convo-orange)]">
                      {plan.badge}
                    </div>
                  ) : null}
                  <h2 className="font-display text-2xl font-bold text-zinc-950">
                    {plan.name}
                  </h2>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-600">
                    {plan.description}
                  </p>
                  <div className="mt-6">
                    <div className="flex items-end gap-1">
                      <span className="font-display text-5xl font-extrabold tracking-normal text-zinc-950">
                        {plan.price}
                      </span>
                      <span className="pb-2 text-sm font-semibold text-zinc-500">
                        {plan.period}
                      </span>
                    </div>
                    {plan.annualPrice ? (
                      <p className="mt-2 text-sm font-semibold text-emerald-700">
                        {plan.annualPrice}/mo on annual billing
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">
                        Monthly plan
                      </p>
                    )}
                  </div>
                  <ul className="mt-7 grid gap-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm text-zinc-700">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-[var(--convo-orange)]">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/login"
                    className={`mt-8 inline-flex justify-center rounded-lg px-5 py-3 text-sm font-bold transition ${
                      plan.badge === "Most popular"
                        ? "bg-[var(--convo-orange)] text-white hover:bg-[var(--convo-orange-hover)]"
                        : "border border-zinc-300 text-zinc-950 hover:border-zinc-500"
                    }`}
                  >
                    Start with {plan.name}
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
              <h2 className="font-display text-2xl font-bold">
                Every new customer gets setup guidance.
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                Convo is designed to be self-serve, but early customers get a
                demo-led activation so the widget, lead capture, CMS publishing,
                and SEO performance tracking are configured properly from day
                one.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-zinc-50">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Compare plans
              </p>
              <h2 className="font-display text-4xl font-extrabold tracking-normal text-zinc-950">
                Pick the workflow depth you need.
              </h2>
            </div>
            <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] bg-zinc-950 text-sm font-bold text-white">
                <div className="p-4">Capability</div>
                <div className="p-4">Starter</div>
                <div className="p-4">Growth</div>
                <div className="p-4">Scale</div>
              </div>
              {comparisons.map(([capability, starter, growth, scale]) => (
                <div
                  key={capability}
                  className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] border-b border-zinc-100 text-sm last:border-b-0"
                >
                  <div className="p-4 font-semibold text-zinc-950">{capability}</div>
                  <div className="p-4 text-zinc-600">{starter}</div>
                  <div className="p-4 text-zinc-600">{growth}</div>
                  <div className="p-4 text-zinc-600">{scale}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTASection />
      </main>
    </MarketingLayout>
  );
}
