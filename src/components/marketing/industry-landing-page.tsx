import Link from "next/link";
import type { IndustryPage } from "@/lib/marketing/industries";
import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";

export function IndustryLandingPage({ page }: { page: IndustryPage }) {
  return (
    <MarketingLayout>
      <main>
        <section className="bg-zinc-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-20">
            <div>
              <p className="inline-flex rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-sm font-semibold text-orange-200">
                {page.eyebrow}
              </p>
              <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                {page.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
                {page.description}
              </p>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-6 text-zinc-200">
                {page.audience}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-lg bg-[var(--convo-orange)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--convo-orange-hover)]"
                >
                  {page.primaryCta}
                </Link>
                <Link
                  href="/features"
                  className="rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/50"
                >
                  {page.secondaryCta}
                </Link>
              </div>
            </div>

            <HeroVisual page={page} />
          </div>
        </section>

        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-5 sm:px-8 md:grid-cols-3">
            {page.painPoints.map((point) => (
              <div key={point} className="flex gap-3 rounded-lg bg-zinc-50 p-4">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--convo-orange)]" />
                <p className="text-sm font-medium leading-6 text-zinc-700">
                  {point}
                </p>
              </div>
            ))}
          </div>
        </section>

        <Section
          eyebrow="Growth loop"
          title="Answer questions, capture enquiries, and create the pages people search for."
          description="Convo connects the immediate conversion job with the longer-term SEO job. The chat helps today's visitor. The conversation data shows what content should exist next."
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
            <div className="grid gap-5 md:grid-cols-2">
              {page.outcomes.map((outcome) => (
                <article
                  key={outcome.title}
                  className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <h2 className="font-display text-2xl font-bold text-zinc-950">
                    {outcome.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">
                    {outcome.description}
                  </p>
                </article>
              ))}
            </div>
            <GrowthProofCard page={page} />
          </div>
        </Section>

        <Section
          eyebrow="Content engine"
          title="Repeated questions become reviewed content that can rank."
          description="The useful insight is simple: if visitors keep asking the same question in chat, other people are probably searching for it in Google too."
          tone="soft"
        >
          <div className="grid gap-5 lg:grid-cols-[460px_1fr]">
            <ContentPipeline page={page} />
            <div className="grid gap-4">
              {page.contentEngine.map((item) => (
                <article
                  key={item.question}
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                    Visitor question
                  </p>
                  <h2 className="mt-2 text-lg font-bold leading-snug text-zinc-950">
                    {item.question}
                  </h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-orange-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--convo-orange)]">
                        Content to create
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-950">
                        {item.content}
                      </p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-3">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">
                        Business result
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-zinc-700">
                        {item.outcome}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </Section>

        <Section
          eyebrow="How it works"
          title="A practical flow from first question to a better website."
          description="Convo can sit before, beside, or inside the existing booking and follow-up process."
        >
          <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
            <div className="grid gap-4">
              {page.workflow.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-bold text-zinc-950">
                        {step.title}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-zinc-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <BookingCard page={page} />
          </div>
        </Section>

        <Section
          eyebrow="Controls"
          title="Built to support the team, not pretend to be one."
          description="The strongest conversion pages make the next step easier while keeping business and clinical boundaries clear."
          tone="soft"
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {page.proofPoints.map((point) => (
              <article
                key={point}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 h-1.5 w-10 rounded-full bg-[var(--convo-orange)]" />
                <p className="text-sm font-semibold leading-6 text-zinc-800">
                  {point}
                </p>
              </article>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="Questions"
          title="What teams ask before using Convo."
          description="Clear answers for the practical objections that come up before a practice installs website chat."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {page.faqs.map((faq) => (
              <article
                key={faq.question}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-lg font-bold text-zinc-950">
                  {faq.question}
                </h2>
                <p className="mt-3 text-sm leading-7 text-zinc-600">
                  {faq.answer}
                </p>
              </article>
            ))}
          </div>
        </Section>

        <CTASection />
      </main>
    </MarketingLayout>
  );
}

function HeroVisual({ page }: { page: IndustryPage }) {
  return (
    <div className="grid gap-4">
      <div
        role="img"
        aria-label={page.heroImage.alt}
        className="min-h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-cover bg-center shadow-2xl shadow-black/30"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(9,9,11,0.03), rgba(9,9,11,0.64)), url(${page.heroImage.src})`,
        }}
      >
        <div className="flex min-h-[340px] items-end p-5">
          <div className="max-w-md rounded-xl bg-white/95 p-4 text-zinc-950 shadow-lg backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
              Website visitor
            </p>
            <p className="mt-2 text-sm font-semibold leading-6">
              {page.chatExample.visitor}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <GrowthProofCard page={page} compact />
        <LeadCaptureMini page={page} />
      </div>
    </div>
  );
}

function GrowthProofCard({
  page,
  compact = false,
}: {
  page: IndustryPage;
  compact?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border border-zinc-200 bg-white p-5 text-zinc-950 shadow-sm ${
        compact ? "" : "lg:sticky lg:top-24 lg:self-start"
      }`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
        {page.growthProof.label}
      </p>
      <h2 className="mt-3 font-display text-xl font-bold">
        {page.growthProof.headline}
      </h2>
      <p className="mt-2 text-sm leading-7 text-zinc-600">
        {page.growthProof.body}
      </p>
      <div className="mt-5 grid gap-3">
        {page.growthProof.metrics.map((metric) => (
          <div
            key={`${metric.value}-${metric.label}`}
            className="rounded-lg bg-zinc-50 p-3"
          >
            <p className="font-display text-2xl font-extrabold text-zinc-950">
              {metric.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function LeadCaptureMini({ page }: { page: IndustryPage }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 text-zinc-950 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
        Captured enquiry
      </p>
      <p className="mt-3 text-sm font-semibold leading-6">
        {page.chatExample.capture}
      </p>
      <p className="mt-4 text-xs leading-5 text-zinc-500">
        {page.chatExample.note}
      </p>
    </article>
  );
}

function ContentPipeline({ page }: { page: IndustryPage }) {
  const firstItem = page.contentEngine[0];

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
        From chat to search
      </p>
      <h2 className="mt-3 font-display text-2xl font-bold text-zinc-950">
        One question can become the next page that wins a customer.
      </h2>
      <div className="mt-6 grid gap-3">
        <PipelineStep
          label="1. Asked in chat"
          title={firstItem.question}
          tone="dark"
        />
        <PipelineStep
          label="2. Content recommended"
          title={firstItem.content}
        />
        <PipelineStep
          label="3. Reviewed and published"
          title="Human-approved page, FAQ, or guide"
        />
        <PipelineStep
          label="4. Measured"
          title="Track search visibility, chats, and enquiries"
        />
      </div>
    </article>
  );
}

function PipelineStep({
  label,
  title,
  tone = "light",
}: {
  label: string;
  title: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "dark"
          ? "border-zinc-900 bg-zinc-950 text-white"
          : "border-zinc-200 bg-zinc-50 text-zinc-950"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase tracking-[0.12em] ${
          tone === "dark" ? "text-orange-200" : "text-zinc-500"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-6">{title}</p>
    </div>
  );
}

function BookingCard({ page }: { page: IndustryPage }) {
  return (
    <aside className="rounded-xl border border-orange-200 bg-orange-50 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
        Booking fit
      </p>
      <p className="mt-3 text-xl font-bold leading-8 text-zinc-950">
        {page.bookingPositioning}
      </p>
      <div className="mt-5 rounded-lg bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
          Example route
        </p>
        <div className="mt-3 grid gap-2 text-sm font-semibold text-zinc-700">
          <span>Ask question</span>
          <span className="text-[var(--convo-orange)]">
            Get approved answer
          </span>
          <span>Choose booking, callback, or follow-up</span>
        </div>
      </div>
    </aside>
  );
}
