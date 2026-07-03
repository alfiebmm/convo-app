import Link from "next/link";
import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import {
  ChatPipelineMockup,
  CompoundingLoop,
  DashboardMockup,
  HomeWorkflow,
} from "@/components/marketing/product-mockups";
import {
  homeFaqs,
  homeFeatureCards,
  homePricingBonuses,
  homePricingTiers,
  homeWorkflowSteps,
  integrations,
  verticalUseCases,
} from "@/lib/marketing/content";
import {
  faqJsonLd,
  marketingMetadata,
  organizationJsonLd,
  softwareApplicationJsonLd,
} from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "AI chatbot + SEO content engine for service-business websites",
  description:
    "Convo is the AI chat that answers your website visitors, captures qualified leads, and writes the SEO content your customers were going to search for anyway. WordPress, Shopify, Webflow.",
  path: "/",
  keywords: [
    "AI chatbot for websites",
    "AI chatbot for dental practices",
    "AI chatbot for service businesses",
    "SEO content automation",
    "website lead capture",
    "AI SEO content",
    "convert website visitors with AI chat",
    "WordPress AI chatbot",
  ],
});

export default function HomePage() {
  const jsonLdGraph = {
    "@context": "https://schema.org",
    "@graph": [
      organizationJsonLd(),
      softwareApplicationJsonLd(),
      faqJsonLd(homeFaqs),
    ],
  };

  return (
    <MarketingLayout>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
        />

        {/* S1 - Hero */}
        <section className="bg-zinc-950 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:pb-24 lg:pt-20">
            <div>
              <p className="mb-5 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-sm font-semibold text-orange-200">
                Chat + content as one product
              </p>
              <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.02em] sm:text-6xl lg:text-7xl">
                Every visitor question becomes the next page that ranks.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                Convo is one AI chat for your website. Every conversation
                captures a qualified lead now and feeds the SEO content your
                customers were going to search for anyway. Both compound.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-lg bg-[var(--convo-orange)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--convo-orange-hover)]"
                >
                  Start free
                </Link>
                <Link
                  href="/how-it-works"
                  className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                >
                  See it live
                </Link>
              </div>
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-zinc-800 pt-6">
                <HeroStat label="Answers" value="24/7" />
                <HeroStat label="Every chat becomes" value="A content signal" />
                <HeroStat label="Live on" value="WP, Shopify, Webflow" />
              </dl>
            </div>
            <ChatPipelineMockup />
          </div>
        </section>

        {/* S2 - Integrations strip */}
        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 py-7 sm:px-8">
            <p className="w-full text-center text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 sm:w-auto sm:text-left">
              Plugs into the stack your business already runs
            </p>
            {integrations.map((integration) => (
              <IntegrationLogo
                key={integration.name}
                integration={integration}
              />
            ))}
          </div>
        </section>

        {/* S3 - Problem */}
        <Section
          eyebrow="The gap"
          title="Your SEO agency is expensive. Your website doesn't answer the phone. Your visitors ask the same questions, and nobody is writing them down."
        >
          <div className="grid gap-5 md:grid-cols-3">
            <ProblemCard
              title="Your agency reports rankings, not customers"
              body="You can't point to a piece of content that brought you a paying customer last quarter. The marketing line item keeps growing."
            />
            <ProblemCard
              title="Your forms ask too early"
              body="Visitors leave the site before they trust you enough to type their email. The enquiry never happens."
            />
            <ProblemCard
              title="Your team has no time to write"
              body="The same questions get answered on the phone every day. Almost none of them ever make it to a page on the website."
            />
          </div>
        </Section>

        {/* S4 - How it works (3 steps) */}
        <Section
          eyebrow="The loop"
          title="Three steps. One growth engine."
          description="Convo turns the visitors you already have into the leads you need today and the content that brings the next visitors back tomorrow."
          tone="soft"
        >
          <HomeWorkflow steps={homeWorkflowSteps} />
        </Section>

        {/* S5 - Features */}
        <Section
          eyebrow="The product"
          title="Built for service businesses that win on answers."
          description="Six capabilities that make the loop work. The detail pages cover the proof, the controls, and the integration notes."
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {homeFeatureCards.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                  {feature.eyebrow}
                </p>
                <h3 className="mt-3 font-display text-xl font-bold">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {feature.description}
                </p>
                <span className="mt-5 inline-flex text-sm font-semibold text-zinc-950 group-hover:text-[var(--convo-orange)]">
                  Explore feature →
                </span>
              </Link>
            ))}
          </div>
        </Section>

        {/* S6 - Compounding loop (the moat made visible) */}
        <Section
          eyebrow="The compounding loop"
          title="Every conversation makes Convo smarter about your customers."
          description="Visitors ask. Convo answers. The questions feed your content. The content brings more visitors. Over time, you end up with a private dataset of exactly what your buyers ask, in their words, that no competitor has access to."
          tone="dark"
        >
          <CompoundingLoop />
        </Section>

        {/* S7 - The dashboard */}
        <Section
          eyebrow="The dashboard"
          title="Watch conversations become published content."
          description="One view. Live chats on the left. The content pipeline on the right. Every published page tracked against impressions, clicks, and the new enquiries that arrived after it shipped."
        >
          <DashboardMockup />
        </Section>

        {/* S8 - Verticals (expansion signal) */}
        <Section
          eyebrow="Built for service businesses"
          title="Whatever your customers ask, Convo learns it."
          description="Convo is strongest when the same buying questions keep landing on your site. We see that pattern across health, services, retail, and the agencies that serve them."
          tone="soft"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {verticalUseCases.map((vertical) => (
              <article
                key={vertical.name}
                className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-zinc-950">
                    {vertical.name}
                  </h3>
                  {vertical.badge ? (
                    <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--convo-orange)] ring-1 ring-inset ring-orange-200">
                      {vertical.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm italic leading-6 text-zinc-600">
                  &ldquo;{vertical.question}&rdquo;
                </p>
              </article>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-sm text-zinc-500">
            Different verticals, same loop. Convo runs the same engine for
            dentists, vets, lawyers, allied health practices, and the agencies
            that build their websites.
          </p>
        </Section>

        {/* S9 - Pricing */}
        <Section
          eyebrow="Pricing"
          title="Annual-first. Three tiers. Pays for itself with one new customer."
          description="Premium pricing because the value gap to a $19 autopilot is wide. One new patient, one new client, one new house sale, and Convo has paid for the year."
        >
          <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.1em] text-white">
              Limited-time bonus
            </span>
            <span className="font-semibold text-emerald-900">
              Every plan includes a free site SEO audit. Growth and Scale add keyword-optimised blog posts.
            </span>
            <Link
              href="/pricing"
              className="ml-auto font-semibold text-emerald-900 underline decoration-emerald-400 underline-offset-4 hover:decoration-emerald-700"
            >
              See launch bonuses →
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {homePricingTiers.map((tier) => {
              const bonus = homePricingBonuses[tier.name];
              return (
              <article
                key={tier.name}
                className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  tier.featured
                    ? "border-[var(--convo-orange)] ring-2 ring-orange-100"
                    : "border-zinc-200"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-xl font-bold text-zinc-950">
                    {tier.name}
                  </h3>
                  {tier.featured ? (
                    <span className="rounded-full bg-[var(--convo-orange)] px-2.5 py-0.5 text-xs font-semibold text-white">
                      Recommended
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-zinc-600">{tier.summary}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-zinc-950">
                    ${tier.annualMonthly}
                  </span>
                  <span className="text-sm text-zinc-500">
                    / month, annual
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Or ${tier.monthly} billed monthly
                </p>
                {bonus ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-emerald-700">
                        Launch bonus
                      </span>
                      <span className="text-xs font-semibold text-emerald-800">
                        {bonus.totalValue} value
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-emerald-900">
                      {bonus.items.map((item) => (
                        <li key={item.label} className="flex items-start gap-1.5">
                          <span className="mt-0.5 text-emerald-600">+</span>
                          <span>
                            <span className="font-semibold">{item.label}</span>
                            <span className="text-emerald-700">
                              {" · "}
                              {item.value}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="mt-5 space-y-2 text-sm text-zinc-700">
                  {tier.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-1 text-[var(--convo-orange)]">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`mt-6 inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    tier.featured
                      ? "bg-[var(--convo-orange)] text-white hover:bg-[var(--convo-orange-hover)]"
                      : "border border-zinc-300 text-zinc-950 hover:border-zinc-500"
                  }`}
                >
                  {tier.cta}
                </Link>
              </article>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
            <p>
              Multi-location, white-label, or DSO scale?{" "}
              <Link
                href="/contact"
                className="font-semibold text-[var(--convo-orange)] hover:underline"
              >
                Talk to us about Enterprise
              </Link>
              .
            </p>
            <Link
              href="/pricing"
              className="font-semibold text-zinc-950 hover:text-[var(--convo-orange)]"
            >
              See full pricing →
            </Link>
          </div>
        </Section>

        {/* S10 - FAQ */}
        <Section
          eyebrow="Questions buyers ask us first"
          title="Five answers up front."
          tone="soft"
        >
          <div className="grid gap-3">
            {homeFaqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                  <h3 className="font-display text-base font-bold text-zinc-950 sm:text-lg">
                    {faq.question}
                  </h3>
                  <span
                    aria-hidden
                    className="text-zinc-400 transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </Section>

        {/* S11 - Final CTA */}
        <CTASection />
      </main>
    </MarketingLayout>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

function ProblemCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h3 className="font-display text-xl font-bold text-zinc-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-600">{body}</p>
    </article>
  );
}

function IntegrationLogo({
  integration,
}: {
  integration: (typeof integrations)[number];
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 shadow-sm">
      <span
        className={`flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-black ${integration.tone}`}
      >
        {integration.mark}
      </span>
      <span className="text-sm font-bold text-zinc-700">
        {integration.name}
      </span>
    </div>
  );
}
