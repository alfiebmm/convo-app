import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { ComparisonTable } from "@/components/marketing/page-blocks";
import { comparisonRows } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Convo vs SearchAtlas: AI Chatbot and SEO Content Comparison",
  description:
    "Compare Convo's conversation-first website improvement workflow with SearchAtlas-style SEO automation.",
  path: "/compare/searchatlas",
  keywords: [
    "Convo vs SearchAtlas",
    "SearchAtlas alternative",
    "AI SEO chatbot",
    "conversation first SEO content",
    "SearchAtlas competitor",
  ],
});

export default function CompareSearchAtlasPage() {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="Comparison"
          title="SearchAtlas starts with SEO data. Convo starts with your customers."
          description="SearchAtlas is strong for broad SEO automation. Convo is built for businesses that want website conversations to become leads, answers, SEO-optimised content, and measurable page improvements."
          headingLevel="h1"
        >
          <ComparisonTable competitor="SearchAtlas" rows={comparisonRows} />
        </Section>
        <Section
          eyebrow="Why Convo"
          title="Choose Convo when the best content source is your own visitors."
          description="Convo wins when chat, lead capture, customer language, and reviewed content updates matter more than running a broad SEO operations suite."
          tone="soft"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["Chat-led demand", "Real visitor questions become the source of topics, FAQs, and page updates."],
              ["Lead capture", "The same conversation can answer the visitor and capture the sales opportunity."],
              ["Proof loop", "New and updated content is measured against search, conversation, and lead signals."],
            ].map(([title, description]) => (
              <article key={title} className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="font-display text-xl font-bold">{title}</h2>
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
