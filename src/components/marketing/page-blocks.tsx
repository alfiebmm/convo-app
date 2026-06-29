import Link from "next/link";
import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";

export function SimpleMarketingPage({
  eyebrow,
  title,
  description,
  blocks,
}: {
  eyebrow: string;
  title: string;
  description: string;
  blocks: Array<{
    title: string;
    description: string;
    items?: readonly string[];
  }>;
}) {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow={eyebrow}
          title={title}
          description={description}
          headingLevel="h1"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {blocks.map((block) => (
              <article
                key={block.title}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="font-display text-2xl font-bold">
                  {block.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {block.description}
                </p>
                {block.items ? (
                  <ul className="mt-5 space-y-2">
                    {block.items.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-zinc-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--convo-orange)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}

export function FeatureDetailPage({
  eyebrow,
  title,
  description,
  sections,
  positioning,
  differentiators,
  outcomes,
  conversion,
  visualExample,
  competitorComparison,
  brandedExamples,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: readonly {
    title: string;
    points: readonly string[];
  }[];
  positioning?: string;
  differentiators?: readonly string[];
  outcomes?: readonly string[];
  conversion?: {
    title: string;
    description: string;
    points: readonly string[];
  };
  visualExample?: {
    type: "lead-flow" | "content-pipeline" | "analytics-card";
    title: string;
    description: string;
  };
  competitorComparison?: {
    title: string;
    description: string;
    competitors?: readonly {
      name: string;
      price: string;
      position: string;
      highlights: readonly string[];
    }[];
    rows: readonly {
      capability: string;
      convo: boolean | string;
      intercom?: boolean | string;
      zendesk?: boolean | string;
      tidio?: boolean | string;
      drift?: boolean | string;
      competitors?: string;
    }[];
  };
  brandedExamples?: {
    title: string;
    description: string;
    examples: readonly {
      brand: string;
      theme: string;
      accentClass: string;
      header: string;
      prompt: string;
      reply: string;
      cta: string;
      signal: string;
    }[];
  };
}) {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow={eyebrow}
          title={title}
          description={description}
          headingLevel="h1"
        >
          {positioning ? (
            <div className="mb-8 max-w-4xl rounded-xl border border-orange-200 bg-orange-50 p-6">
              <p className="text-lg font-semibold leading-8 text-zinc-950">
                {positioning}
              </p>
            </div>
          ) : null}
          <div className="grid gap-5 lg:grid-cols-3">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="font-display text-xl font-bold">
                  {section.title}
                </h2>
                <ul className="mt-5 space-y-3">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-3 text-sm text-zinc-700">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-[var(--convo-orange)]">
                        ✓
                      </span>
                      <span className="leading-6">{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          {differentiators?.length || outcomes?.length ? (
            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              {differentiators?.length ? (
                <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="font-display text-2xl font-bold">
                    Why it is different
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {differentiators.map((point) => (
                      <li key={point} className="flex gap-3 text-sm text-zinc-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--convo-orange)]" />
                        <span className="leading-6">{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {outcomes?.length ? (
                <article className="rounded-xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm">
                  <h2 className="font-display text-2xl font-bold">
                    What the business gets
                  </h2>
                  <ul className="mt-5 space-y-3">
                    {outcomes.map((point) => (
                      <li key={point} className="flex gap-3 text-sm text-zinc-300">
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-400/10 text-xs font-bold text-orange-200">
                          ✓
                        </span>
                        <span className="leading-6">{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ) : null}
            </div>
          ) : null}
          {conversion ? (
            <div className="mt-10 rounded-xl border border-zinc-200 bg-zinc-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Conversion angle
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold">
                {conversion.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                {conversion.description}
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {conversion.points.map((point) => (
                  <div
                    key={point}
                    className="rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium leading-6 text-zinc-700"
                  >
                    {point}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {visualExample ? (
            <VisualExample example={visualExample} />
          ) : null}
          {brandedExamples ? (
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Branded widget examples
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold">
                {brandedExamples.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
                {brandedExamples.description}
              </p>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {brandedExamples.examples.map((example) => (
                  <article
                    key={example.brand}
                    className="overflow-hidden rounded-2xl border border-zinc-800 bg-white text-zinc-950 shadow-2xl shadow-black/20"
                  >
                    <div className={`${example.accentClass} p-4 text-white`}>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-80">
                            {example.theme}
                          </p>
                          <h3 className="mt-1 font-display text-2xl font-bold">
                            {example.brand}
                          </h3>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-black">
                          {example.brand.slice(0, 2)}
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="mb-4 flex items-center gap-3">
                          <div className={`${example.accentClass} h-9 w-9 rounded-full`} />
                          <div>
                            <p className="text-sm font-bold">{example.header}</p>
                            <p className="text-xs text-zinc-500">
                              Online now
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="max-w-[88%] rounded-xl bg-white px-3 py-2 text-sm leading-6 text-zinc-700 shadow-sm">
                            {example.prompt}
                          </div>
                          <div className={`${example.accentClass} ml-auto max-w-[88%] rounded-xl px-3 py-2 text-sm leading-6 text-white`}>
                            {example.reply}
                          </div>
                        </div>
                        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
                            Intent signal
                          </p>
                          <p className="mt-1 text-sm font-semibold text-zinc-950">
                            {example.signal}
                          </p>
                        </div>
                        <button className={`${example.accentClass} mt-3 w-full rounded-lg px-4 py-3 text-sm font-bold text-white`}>
                          {example.cta}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
          {competitorComparison ? (
            <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                Competitive comparison
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold">
                {competitorComparison.title}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                {competitorComparison.description}
              </p>
              {competitorComparison.competitors ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {competitorComparison.competitors.map((competitor) => (
                  <article
                    key={competitor.name}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <h3 className="font-display text-lg font-bold">
                      {competitor.name}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-[var(--convo-orange)]">
                      {competitor.price}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">
                      {competitor.position}
                    </p>
                    <ul className="mt-4 space-y-2">
                      {competitor.highlights.map((highlight) => (
                        <li
                          key={highlight}
                          className="flex gap-2 text-sm leading-6 text-zinc-700"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
              ) : null}
              <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
                <div className="grid min-w-[760px] grid-cols-[1.4fr_repeat(5,0.8fr)] bg-zinc-950 text-sm font-bold text-white">
                  <div className="p-4">Capability</div>
                  <div className="p-4 text-center">Convo</div>
                  <div className="p-4 text-center">Intercom</div>
                  <div className="p-4 text-center">Zendesk</div>
                  <div className="p-4 text-center">Tidio</div>
                  <div className="p-4 text-center">Drift</div>
                </div>
                {competitorComparison.rows.map((row) => (
                  <div
                    key={row.capability}
                    className="grid min-w-[760px] grid-cols-[1.4fr_repeat(5,0.8fr)] border-b border-zinc-100 text-sm last:border-b-0"
                  >
                    <div className="p-4 font-semibold text-zinc-950">
                      {row.capability}
                    </div>
                    <FeatureCell value={row.convo} strong />
                    <FeatureCell value={row.intercom ?? row.competitors ?? false} />
                    <FeatureCell value={row.zendesk ?? row.competitors ?? false} />
                    <FeatureCell value={row.tidio ?? row.competitors ?? false} />
                    <FeatureCell value={row.drift ?? row.competitors ?? false} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
            <h2 className="font-display text-2xl font-bold">
              Ready to see the workflow?
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Start with the product flow, then choose the setup that fits your
              website, lead process, and publishing workflow.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-[var(--convo-orange)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--convo-orange-hover)]"
              >
                Start free
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500"
              >
                See how it works
              </Link>
            </div>
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}

export function ComparisonTable({
  competitor,
  rows,
}: {
  competitor: string;
  rows: readonly (readonly [string, boolean, boolean])[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr] border-b border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-950">
        <div className="p-4">Feature</div>
        <div className="p-4 text-center">Convo</div>
        <div className="p-4 text-center">{competitor}</div>
      </div>
      {rows.map(([feature, convo, other]) => (
        <div
          key={feature}
          className="grid grid-cols-[1.4fr_0.8fr_0.8fr] border-b border-zinc-100 text-sm last:border-b-0"
        >
          <div className="p-4 text-zinc-700">{feature}</div>
          <CheckCell value={convo} />
          <CheckCell value={other} />
        </div>
      ))}
    </div>
  );
}

function CheckCell({ value }: { value: boolean }) {
  return (
    <div
      className={`flex items-center justify-center p-4 text-lg font-bold ${
        value ? "text-emerald-600" : "text-zinc-300"
      }`}
      aria-label={value ? "Included" : "Not included"}
    >
      {value ? "✓" : "×"}
    </div>
  );
}

function VisualExample({
  example,
}: {
  example: {
    type: "lead-flow" | "content-pipeline" | "analytics-card";
    title: string;
    description: string;
  };
}) {
  return (
    <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
        Example workflow
      </p>
      <h2 className="mt-3 font-display text-3xl font-bold">{example.title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
        {example.description}
      </p>
      <div className="mt-6">
        {example.type === "lead-flow" ? <LeadFlowMockup /> : null}
        {example.type === "content-pipeline" ? <ContentPipelineMockup /> : null}
        {example.type === "analytics-card" ? <AnalyticsCardMockup /> : null}
      </div>
    </div>
  );
}

function LeadFlowMockup() {
  const steps = [
    ["Chat", "Visitor asks for a Cavoodle breeder near Brisbane"],
    ["Lead", "Breed, location, budget, and timing detected"],
    ["Route", "Send to CRM, spreadsheet, webhook, or API"],
  ] as const;

  const destinations = ["HubSpot", "Salesforce", "Google Sheets", "REST API"];

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map(([label, copy], index) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-sm font-black text-[var(--convo-orange)]">
                {index + 1}
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{label}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{copy}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-200">
          Lead destinations
        </p>
        <div className="mt-4 grid gap-3">
          {destinations.map((destination) => (
            <div
              key={destination}
              className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 p-3"
            >
              <span className="text-sm font-semibold">{destination}</span>
              <span className="text-sm font-black text-emerald-300">✓</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContentPipelineMockup() {
  const items = [
    ["New", "Best Cavoodle breeders near Brisbane", "Ready for draft"],
    ["Edit", "Questions to ask before choosing a breeder", "Existing FAQ gap"],
    ["Publish", "Puppy buyer checklist", "Approved for CMS"],
  ] as const;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map(([status, title, note]) => (
          <article key={title} className="rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded bg-orange-50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--convo-orange)]">
                {status}
              </span>
              <span className="text-xs font-semibold text-zinc-400">SEO</span>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{note}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full w-3/4 rounded-full bg-[var(--convo-orange)]" />
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-600">
        {["WordPress", "Shopify", "Webflow", "REST"].map((cms) => (
          <span key={cms} className="rounded-full border border-zinc-200 bg-white px-3 py-1">
            Publish to {cms}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnalyticsCardMockup() {
  const metrics = [
    ["Clicks", "+38%", "1,240"],
    ["Views", "+61%", "18.6k"],
    ["Avg. position", "+4.2", "8.7"],
    ["SEO leads", "+19", "47"],
  ] as const;

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <span className="rounded bg-emerald-50 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em] text-emerald-700">
          Posted
        </span>
        <h3 className="mt-4 font-display text-2xl font-bold">
          Best Cavoodle breeders near Brisbane
        </h3>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Published from repeated Doggo chat questions about breed, location,
          waitlists, and breeder checks.
        </p>
      </article>
      <div className="rounded-xl border border-zinc-200 bg-zinc-950 p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-200">
          SEO performance
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {metrics.map(([label, change, value]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-sm text-zinc-400">{label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="font-display text-3xl font-bold">{value}</span>
                <span className="text-sm font-bold text-emerald-300">{change}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCell({
  value,
  strong = false,
}: {
  value: boolean | string;
  strong?: boolean;
}) {
  if (typeof value === "boolean") {
    return (
      <div
        className={`flex items-center justify-center p-4 text-xl font-black ${
          value ? "text-emerald-600" : "text-zinc-300"
        }`}
        aria-label={value ? "Included" : "Not included"}
      >
        {value ? "✓" : "×"}
      </div>
    );
  }

  return (
    <div
      className={`p-4 text-center text-sm font-semibold leading-6 ${
        strong ? "text-[var(--convo-orange)]" : "text-zinc-600"
      }`}
    >
      {value}
    </div>
  );
}
