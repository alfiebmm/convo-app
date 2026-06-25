import Link from "next/link";
import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import {
  ChatPipelineMockup,
  WorkflowDiagram,
} from "@/components/marketing/product-mockups";
import {
  featureCards,
  integrations,
  useCases,
  workflowSteps,
} from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "AI Chatbot That Turns Conversations Into Blog Posts That Rank",
  description:
    "Convo chats with website visitors, captures leads, and turns recurring questions into SEO-optimised articles, FAQs, and website updates with measurable performance.",
  path: "/",
  keywords: [
    "AI chatbot for websites",
    "website chatbot",
    "SEO blog generator",
    "AI lead capture",
    "turn conversations into content",
    "SEO content automation",
  ],
});

export default function HomePage() {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Convo",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "AI chatbot that turns website conversations into leads, FAQs, and SEO-optimised blog posts that rank.",
    offers: {
      "@type": "Offer",
      price: "99",
      priceCurrency: "USD",
    },
  };

  return (
    <MarketingLayout>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <section className="bg-zinc-950 text-white">
          <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
            <div>
              <p className="mb-5 inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-sm font-semibold text-orange-200">
                Chat, lead capture, and content improvement in one loop
              </p>
              <h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
                Turn website conversations into blog posts that rank.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                Convo chats with your website visitors, captures leads at the
                right moment, and turns recurring questions into SEO-optimised
                articles, FAQs, and website updates with measurable performance.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-lg bg-[var(--convo-orange)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--convo-orange-hover)]"
                >
                  Start free
                </Link>
                <Link
                  href="/how-it-works"
                  className="rounded-lg border border-zinc-700 px-5 py-3 text-sm font-semibold text-white transition hover:border-zinc-500"
                >
                  See how it works
                </Link>
              </div>
              <div className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-zinc-800 pt-6">
                <Metric label="Lead signal" value="Puppy enquiry" />
                <Metric label="Content action" value="Breed guide" />
                <Metric label="Result" value="Tracked lead" />
              </div>
            </div>
            <ChatPipelineMockup />
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-5 py-6 sm:px-8">
            {integrations.map((integration) => (
              <IntegrationLogo key={integration.name} integration={integration} />
            ))}
          </div>
        </section>

        <Section
          eyebrow="Problem"
          title="Most websites are full of unanswered buying intent."
          description="Visitors ask about price, suitability, setup, timing, and trust. Those questions usually disappear into chat logs, form submissions, or inboxes. Convo turns them into a usable growth system."
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              [
                "Content teams guess topics",
                "Convo uses real customer language from your own site.",
              ],
              [
                "Forms ask too early",
                "Convo can wait until the visitor has context and intent.",
              ],
              [
                "Old pages drift",
                "Convo can recommend updates when the answer already exists.",
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="font-display text-xl font-bold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="How it works"
          title="One loop from helpful chat to reviewed website improvement."
          description="Install the widget, connect your business knowledge, capture the right lead signals, and review every recommendation before anything changes."
          tone="soft"
        >
          <WorkflowDiagram />
        </Section>

        <Section
          eyebrow="Features"
          title="Built for conversations that become commercial assets."
          description="Convo brings chat, lead capture, SEO optimisation, content decisions, publishing workflow, and performance tracking into one connected system."
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                  {feature.eyebrow}
                </p>
                <h2 className="mt-3 font-display text-xl font-bold">
                  {feature.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {feature.description}
                </p>
                <span className="mt-5 inline-flex text-sm font-semibold text-zinc-950 group-hover:text-[var(--convo-orange)]">
                  Explore feature
                </span>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Growth loop"
          title="Better answers create better demand signals."
          description="The chatbot helps visitors now. The dashboard uses what they ask, plus search and keyword data, to improve the site and prove what changed later."
          tone="dark"
        >
          <div className="grid gap-5 md:grid-cols-4">
            {workflowSteps.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
                <h2 className="font-display text-xl font-bold text-white">
                  {step.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="SEO performance"
          title="Instant value means showing what moved."
          description="New and updated content is tracked against the signals buyers care about: impressions, clicks, keyword movement, conversations, and leads."
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              [
                "Optimise before publishing",
                "Use target keywords, supporting terms, metadata, internal links, FAQ opportunities, and an SEO checklist.",
              ],
              [
                "Connect real data",
                "Use Google Search Console, GA4, and Ahrefs-style keyword inputs where connected or imported.",
              ],
              [
                "Prove the result",
                "Track before/after performance for new and updated content URLs inside the dashboard.",
              ],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="font-display text-xl font-bold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Use cases"
          title="Built for websites where questions become revenue."
          description="Convo is strongest when the same buyer questions keep appearing across chat, forms, search, and sales calls."
          tone="soft"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((useCase) => (
              <Link
                key={useCase}
                href="/use-cases"
                className="rounded-xl border border-zinc-200 bg-white p-5 font-semibold shadow-sm transition hover:border-orange-200"
              >
                {useCase}
              </Link>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Proof format"
          title="Show the before and after, not vague AI magic."
          description="See the chat excerpt, extracted intent, content decision, and reviewed output so the workflow is easy to understand."
        >
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:p-8">
            <div className="grid gap-5 md:grid-cols-3">
              <ExampleStep title="Conversation" text="Visitor asks three questions about a buying decision." />
              <ExampleStep title="Recommendation" text="Convo detects an FAQ gap and one high-intent lead." />
              <ExampleStep title="Output" text="The business reviews a FAQ update and a content brief." />
            </div>
          </div>
        </Section>

        <CTASection />
      </main>
    </MarketingLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
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
      <span className="text-sm font-bold text-zinc-700">{integration.name}</span>
    </div>
  );
}

function ExampleStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{text}</p>
    </div>
  );
}
