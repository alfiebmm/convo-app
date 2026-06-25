import { WorkflowDiagram } from "@/components/marketing/product-mockups";
import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { marketingMetadata } from "@/lib/marketing/seo";
import { integrations } from "@/lib/marketing/content";

export const metadata = marketingMetadata({
  title: "How Convo Turns Website Chats Into SEO Content",
  description:
    "See how Convo moves from visitor questions to lead capture, content decisions, human review, and CMS publishing.",
  path: "/how-it-works",
  keywords: [
    "how AI chatbot creates content",
    "website chat to blog posts",
    "conversation to SEO content",
    "AI content workflow",
    "CMS publishing workflow",
  ],
});

export default function HowItWorksPage() {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="How it works"
          title="One chat can become a lead, a content idea, and a better page."
          description="Convo does not stop at answering the question. It captures what the visitor wanted, decides what the website should do next, and gives your team a reviewed path to publish or improve."
          headingLevel="h1"
        >
          <WorkflowDiagram />
        </Section>
        <Section
          eyebrow="Live example"
          title="The chat is only the start."
          description="A visitor gets help. Convo captures the useful signal behind the conversation and turns it into the next business action."
          tone="soft"
        >
          <ConversationToGrowthMockup />
        </Section>
        <Section
          eyebrow="Core loop"
          title="Built around how the business already works."
          description="Convo connects chat, lead capture, content workflow, publishing, and measurement instead of creating another isolated tool."
        >
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              [
                "Uses your knowledge",
                "Site pages, uploaded docs, FAQs, and guardrails make the assistant useful from day one.",
                ["Site pages", "Uploaded files", "Guardrails"],
              ],
              [
                "Routes the lead",
                "Subtle lead capture sends the right context into the tools the team already uses.",
                ["HubSpot", "Salesforce", "Sheets", "API"],
              ],
              [
                "Measures the result",
                "Published content is tracked against Google-style search and conversion metrics.",
                ["Clicks", "Views", "Rankings", "Leads"],
              ],
            ].map(([title, description, chips]) => (
              <article
                key={title as string}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="font-display text-2xl font-bold">
                  {title as string}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {description as string}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(chips as string[]).map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[var(--convo-orange)]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
        <Section
          eyebrow="Integrations"
          title="Works with your stack, not against it."
          description="The value is not just the chat. It is the way Convo connects to the content, CRM, CMS, analytics, and search tools the business already depends on."
          tone="soft"
        >
          <IntegrationWorkflow />
        </Section>
        <Section
          eyebrow="Product view"
          title="The workflow is visible before anything changes."
          description="Teams can see the chat, the extracted signal, the recommended action, and the output before publishing."
        >
          <ReviewWorkflowMockup />
        </Section>
        <Section
          eyebrow="Controls"
          title="Useful automation, with review where it matters."
          description="Convo can move fast without making the website feel risky. The business controls lead capture, content actions, and publishing."
          tone="dark"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["Lead timing", "Ask after the visitor has shown topic, location, budget, urgency, or fit."],
              ["Content action", "Choose create, update, merge, skip, or publish based on existing coverage."],
              ["Publishing", "Keep review as default. Auto-publish only when the customer explicitly enables it."],
            ].map(([title, description]) => (
              <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="font-display text-xl font-bold text-white">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
              </div>
            ))}
          </div>
        </Section>
        <Section
          eyebrow="Outcome"
          title="The website gets smarter from the questions it already receives."
          description="Convo connects the dots between search demand, visitor intent, chat quality, lead capture, and published content."
        >
          <div className="grid gap-5 md:grid-cols-4">
            {[
              ["Fewer dead-end chats", "Visitors get a useful next step."],
              ["Better lead context", "Sales sees what the visitor actually asked."],
              ["Sharper content ideas", "Topics come from first-party demand."],
              ["Measured improvement", "Track clicks, rankings, chats, and leads."],
            ].map(([title, description]) => (
              <article
                key={title}
                className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <h2 className="font-display text-lg font-bold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
              </article>
            ))}
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}

function ConversationToGrowthMockup() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl bg-zinc-950 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-200">
            Live chat
          </p>
          <div className="mt-4 space-y-3">
            <div className="max-w-[88%] rounded-xl bg-zinc-800 px-3 py-2 text-sm leading-6">
              I need a Cavoodle breeder near Brisbane with puppies available soon.
            </div>
            <div className="ml-auto max-w-[88%] rounded-xl bg-[var(--convo-orange)] px-3 py-2 text-sm leading-6">
              I can show breeder matches and send a checklist for health checks,
              deposits, and waitlists.
            </div>
          </div>
          <button className="mt-4 w-full rounded-lg bg-white px-4 py-3 text-sm font-bold text-zinc-950">
            Send breeder matches
          </button>
        </div>
        <div className="grid gap-3">
          {[
            ["Intent", "Breed + location + availability", "Detect"],
            ["Subtle lead capture", "Ready for shortlist follow-up", "Route"],
            ["Content signal", "Best Cavoodle breeders near Brisbane", "Create"],
            ["Tracked result", "Clicks, chats, rankings, and leads", "Measure"],
          ].map(([label, value, badge]) => (
            <div key={label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                    {label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-zinc-950">{value}</p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--convo-orange)] shadow-sm">
                  {badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrationWorkflow() {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
          Connected loop
        </p>
        <div className="mt-5 grid gap-3">
          {[
            ["Business knowledge", "Website pages, uploaded files, FAQs"],
            ["Lead tools", "HubSpot, Salesforce, Google Sheets, webhook"],
            ["Publishing", "WordPress, Shopify, Webflow, REST"],
            ["Performance", "Search Console, GA4, keyword data"],
          ].map(([title, description]) => (
            <div
              key={title}
              className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
            >
              <div>
                <h2 className="font-display text-lg font-bold">{title}</h2>
                <p className="mt-1 text-sm text-zinc-600">{description}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-orange-50 px-3 py-2 text-sm font-black text-[var(--convo-orange)]">
                ✓
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-200">
          Integrations
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
            >
              <span
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-black ${integration.tone}`}
              >
                {integration.mark}
              </span>
              <p className="mt-3 text-sm font-bold text-white">
                {integration.name}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewWorkflowMockup() {
  const columns = [
    ["Conversation", "Visitor asks a buying question the site should answer better."],
    ["Signal", "Convo extracts intent, topic, page context, and follow-up need."],
    ["Recommendation", "Create a guide, update an FAQ, capture a lead, or skip."],
    ["Result", "Publish, route, and measure clicks, chats, rankings, and leads."],
  ] as const;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-4 lg:grid-cols-4">
        {columns.map(([title, description], index) => (
          <article key={title} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-sm font-black text-[var(--convo-orange)]">
              {index + 1}
            </div>
            <h2 className="mt-4 font-display text-xl font-bold">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-zinc-950">
              Recommended output: Best Cavoodle breeders near Brisbane
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Source: 18 similar conversations, high commercial intent
            </p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-700">
              Edit
            </span>
            <span className="rounded-lg bg-[var(--convo-orange)] px-3 py-2 text-sm font-bold text-white">
              Approve
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
