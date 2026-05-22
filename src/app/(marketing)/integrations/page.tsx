import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { integrations } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Integrations for CMS Publishing and SEO Performance",
  description:
    "Connect Convo to CMS publishing, lead workflows, Google Search Console, GA4, and keyword research inputs.",
  path: "/integrations",
  keywords: [
    "CMS publishing integrations",
    "Google Search Console integration",
    "GA4 content performance",
    "Ahrefs keyword research",
    "AI chatbot integrations",
  ],
});

const groups = [
  {
    title: "Publish content where your site already lives",
    description:
      "Move approved articles, FAQs, and page updates into the CMS workflow your team already uses.",
    items: ["WordPress", "Shopify", "Webflow", "Custom API"],
  },
  {
    title: "Measure the SEO impact",
    description:
      "Connect search and analytics data so content work is tied to impressions, clicks, rankings, conversations, and leads.",
    items: ["Google Search Console", "Google Analytics", "Ahrefs"],
  },
  {
    title: "Route leads into the sales process",
    description:
      "Capture leads with conversation context and pass them into the systems your team uses to follow up.",
    items: ["Lead inbox", "Notifications", "Webhooks", "CRM-ready routing"],
  },
];

export default function IntegrationsPage() {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="Integrations"
          title="Connect Convo to the tools that already run your website."
          description="Convo brings chat, lead capture, CMS publishing, keyword research, and performance reporting into one workflow."
          headingLevel="h1"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {integrations.map((integration) => (
              <div
                key={integration.name}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <span
                  className={`flex h-12 min-w-12 items-center justify-center rounded-xl border px-2 font-display text-sm font-black ${integration.tone}`}
                >
                  {integration.mark}
                </span>
                <span className="text-sm font-bold text-zinc-800">
                  {integration.name}
                </span>
              </div>
            ))}
          </div>
        </Section>
        <Section
          eyebrow="Workflow"
          title="From visitor question to published, measured content."
          description="The integrations are not just plumbing. They make Convo more valuable by connecting content decisions to the systems that publish, measure, and follow up."
          tone="soft"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {groups.map((group) => (
              <article
                key={group.title}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="font-display text-xl font-bold text-zinc-950">
                  {group.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {group.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}
