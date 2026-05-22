import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { ComparisonTable } from "@/components/marketing/page-blocks";
import { comparisonRows } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Convo vs Opinly: Conversation-Led SEO Content",
  description:
    "Compare Convo's conversation-first workflow with Opinly-style SEO and LLM traffic automation.",
  path: "/compare/opinly",
  keywords: [
    "Convo vs Opinly",
    "Opinly alternative",
    "AI SEO chatbot",
    "LLM traffic automation alternative",
    "chatbot for SEO content",
  ],
});

export default function CompareOpinlyPage() {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="Comparison"
          title="Opinly automates SEO tasks. Convo turns conversations into website improvements."
          description="Opinly focuses on SEO and AI visibility automation. Convo focuses on turning first-party visitor demand into leads, answers, reviewed content decisions, and measurable content performance."
          headingLevel="h1"
        >
          <ComparisonTable competitor="Opinly" rows={comparisonRows} />
        </Section>
        <Section
          eyebrow="Why Convo"
          title="Choose Convo when your website questions are the growth signal."
          description="Convo is strongest when businesses want a chatbot that does more than answer questions: it captures leads, improves FAQs, creates SEO content, and shows what changed."
          tone="soft"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["First-party questions", "Topics come from what visitors actually ask before they buy."],
              ["Website content updates", "Convo recommends new pages, FAQ changes, page updates, or no action."],
              ["Sales context", "Lead capture keeps the conversation attached to the contact."],
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
