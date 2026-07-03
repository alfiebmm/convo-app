import Link from "next/link";
import { CTASection, MarketingLayout } from "@/components/marketing/marketing-layout";
import { homePricingTiers } from "@/lib/marketing/content";
import {
  faqJsonLd,
  marketingMetadata,
  softwareApplicationJsonLd,
} from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Convo Pricing for AI Chatbot, Leads, and SEO Content",
  description:
    "Compare Convo pricing for website chat, lead capture, SEO content, CMS publishing, performance tracking, and launch bonuses.",
  path: "/pricing",
  keywords: [
    "AI chatbot pricing",
    "SEO content automation pricing",
    "lead capture chatbot pricing",
    "website chatbot pricing",
    "Convo pricing",
  ],
});

const comparisons = [
  ["Website chat", "Included", "Included", "Included"],
  ["Lead capture", "Included", "Advanced", "Advanced"],
  ["SEO content", "Basic queue", "Full workflow", "Multi-site workflow"],
  ["CMS publishing", "Manual export", "Included", "Included"],
  ["SEO data", "Basic", "GSC, GA4, Ahrefs-style inputs", "Advanced reporting"],
  ["Onboarding", "Self-serve", "Demo-led", "Dedicated"],
] as const;

const planBonuses: Record<
  string,
  {
    totalValue: string;
    items: Array<{
      label: string;
      value: string;
    }>;
  }
> = {
  Starter: {
    totalValue: "$2,000",
    items: [
      {
        label: "Free site SEO audit",
        value: "Valued up to $2,000",
      },
    ],
  },
  Growth: {
    totalValue: "$4,500",
    items: [
      {
        label: "Free site SEO audit",
        value: "Valued up to $2,000",
      },
      {
        label: "5 free keyword-optimised blog posts",
        value: "Usually $2,500",
      },
    ],
  },
  Scale: {
    totalValue: "$7,000",
    items: [
      {
        label: "Free site SEO audit",
        value: "Valued up to $2,000",
      },
      {
        label: "10 free keyword-optimised blog posts",
        value: "Usually $5,000",
      },
    ],
  },
};

const pricingFaqs = [
  {
    question: "How much does Convo cost?",
    answer:
      "Convo plans start at $249 per month on annual billing, with monthly billing available from $299 per month. Growth is $499 per month on annual billing, and Scale is $899 per month on annual billing.",
  },
  {
    question: "What is included in the Convo launch bonus?",
    answer:
      "Every plan includes a free site SEO audit valued up to $2,000. Growth also includes five keyword-optimised blog posts, and Scale includes ten keyword-optimised blog posts.",
  },
  {
    question: "Which Convo plan should I choose?",
    answer:
      "Starter suits a single site getting started with AI chat, lead capture, and content. Growth suits service businesses that want a stronger SEO content workflow. Scale suits multi-location or premium service brands that need more content volume and support.",
  },
  {
    question: "Does Convo include SEO content and CMS publishing?",
    answer:
      "Yes. Convo combines website chat, lead capture, SEO content workflows, CMS publishing, and performance tracking in one platform. Plan depth varies by tier.",
  },
  {
    question: "Can I pay monthly instead of annually?",
    answer:
      "Yes. Annual billing is shown as the primary price because it has the lowest monthly equivalent. Monthly billing is available on all plans.",
  },
] as const;

export default function PricingPage() {
  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [softwareApplicationJsonLd(), faqJsonLd(pricingFaqs)],
  };

  return (
    <MarketingLayout>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
        />

        <section className="bg-zinc-950 text-white">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Pricing
              </p>
              <h1 className="font-display text-4xl font-extrabold leading-tight tracking-normal sm:text-6xl">
                Chat, leads, and SEO content in one growth loop.
              </h1>
              <p className="mt-6 text-lg leading-8 text-zinc-300">
                Convo replaces separate tools for website chat, lead capture,
                content briefs, CMS publishing, and content performance
                tracking. Start self-serve, then use a demo to tune the setup
                for your business.
              </p>
              <div className="mt-8 flex w-full max-w-sm flex-col rounded-2xl border border-orange-400/30 bg-orange-400/10 p-1 text-sm font-semibold text-orange-100 sm:inline-flex sm:w-auto sm:max-w-none sm:flex-row sm:rounded-full">
                <span className="rounded-xl bg-[var(--convo-orange)] px-4 py-2 text-white sm:rounded-full">
                  Annual billing shown
                </span>
                <span className="px-4 py-2">Monthly billing available</span>
              </div>
              <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5">
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-200">
                  Limited-time bonus
                </p>
                <p className="mt-2 max-w-2xl text-lg font-semibold leading-7 text-white">
                  Every plan includes a free site SEO audit. Growth and Scale
                  also include keyword-optimised blog posts so the first month
                  starts with visible value, not another blank content plan.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="grid min-w-0 gap-5 lg:grid-cols-3">
              {homePricingTiers.map((tier) => (
                <PricingCard key={tier.name} tier={tier} />
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
            <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="min-w-[720px]">
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
                    <div className="p-4 font-semibold text-zinc-950">
                      {capability}
                    </div>
                    <div className="p-4 text-zinc-600">{starter}</div>
                    <div className="p-4 text-zinc-600">{growth}</div>
                    <div className="p-4 text-zinc-600">{scale}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Pricing FAQ
              </p>
              <h2 className="font-display text-4xl font-extrabold tracking-normal text-zinc-950">
                Answers before you pick a plan.
              </h2>
            </div>
            <div className="mt-10 divide-y divide-zinc-200 border-y border-zinc-200">
              {pricingFaqs.map((item) => (
                <div key={item.question} className="py-6">
                  <h3 className="text-lg font-bold text-zinc-950">
                    {item.question}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-zinc-600">
                    {item.answer}
                  </p>
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

function PricingCard({
  tier,
}: {
  tier: (typeof homePricingTiers)[number];
}) {
  const bonus = planBonuses[tier.name];

  return (
    <article
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white p-6 shadow-sm ${
        tier.featured
          ? "border-[var(--convo-orange)] shadow-orange-100"
          : "border-zinc-200"
      }`}
    >
      {tier.featured ? (
        <div className="absolute right-5 top-5 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--convo-orange)]">
          Recommended
        </div>
      ) : null}
      <h2 className="font-display text-2xl font-bold text-zinc-950">
        {tier.name}
      </h2>
      <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-600">
        {tier.summary}
      </p>
      <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
              Bonus
            </p>
            <p className="mt-1 text-sm font-bold text-emerald-950">
              Limited-time launch offer
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Value
            </p>
            <p className="text-lg font-extrabold leading-tight text-emerald-950">
              <span className="decoration-2 line-through">
                {bonus.totalValue}
              </span>{" "}
              free
            </p>
          </div>
        </div>
        <ul className="mt-4 grid gap-2">
          {bonus.items.map((item) => (
            <li
              key={item.label}
              className="flex gap-3 text-sm text-emerald-950"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                ✓
              </span>
              <span>
                <span className="font-semibold">{item.label}</span>
                <span className="block text-xs font-medium text-emerald-700">
                  {item.value}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-6">
        <div className="flex items-end gap-1">
          <span className="font-display text-5xl font-extrabold tracking-normal text-zinc-950">
            ${tier.annualMonthly}
          </span>
          <span className="pb-2 text-sm font-semibold text-zinc-500">
            /mo, annual
          </span>
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Or ${tier.monthly}/mo billed monthly
        </p>
      </div>
      <ul className="mt-7 grid gap-3">
        {tier.points.map((point) => (
          <li key={point} className="flex gap-3 text-sm text-zinc-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-[var(--convo-orange)]">
              ✓
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Link
          href="/signup"
          className={`inline-flex w-full justify-center rounded-lg px-5 py-3 text-sm font-bold transition ${
            tier.featured
              ? "bg-[var(--convo-orange)] text-white hover:bg-[var(--convo-orange-hover)]"
              : "border border-zinc-300 text-zinc-950 hover:border-zinc-500"
          }`}
        >
          Start with {tier.name}
        </Link>
      </div>
    </article>
  );
}
