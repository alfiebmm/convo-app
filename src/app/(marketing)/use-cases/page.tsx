import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "AI Chatbot Use Cases for Services, Ecommerce, and Agencies",
  description:
    "See how Convo helps service businesses, ecommerce stores, marketplaces, and agencies turn visitor questions into leads and SEO content.",
  path: "/use-cases",
  keywords: [
    "AI chatbot for service businesses",
    "AI chatbot for ecommerce",
    "SEO content for agencies",
    "marketplace chatbot",
    "lead capture use cases",
  ],
});

const useCases = [
  {
    title: "Service Businesses",
    description:
      "Turn pricing, timing, and suitability questions into qualified enquiries, stronger FAQs, and service pages that answer buyers before they call.",
    examples: ["Builders", "Clinics", "Accountants", "Tutors"],
  },
  {
    title: "Ecommerce",
    description:
      "Use product questions to improve category pages, buying guides, product education, and lead capture for higher-consideration purchases.",
    examples: ["Buying guides", "Product fit", "Care advice", "Comparison content"],
  },
  {
    title: "Marketplaces",
    description:
      "Capture buyer and seller questions, then turn recurring demand into search-friendly content that helps both sides of the marketplace move faster.",
    examples: ["Buyer education", "Seller FAQs", "Category pages", "Trust content"],
  },
  {
    title: "Agencies",
    description:
      "Give clients a visible pipeline from website conversations to SEO-optimised content, page updates, and measurable performance gains.",
    examples: ["Client reporting", "Content queues", "CMS workflows", "Multi-site growth"],
  },
];

export default function UseCasesPage() {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="Use cases"
          title="Where Convo creates the fastest lift."
          description="Convo fits businesses that hear the same questions again and again. Those questions are buyer intent, content strategy, and conversion research hiding in plain sight."
          headingLevel="h1"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {useCases.map((useCase) => (
              <article
                key={useCase.title}
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <h2 className="font-display text-2xl font-bold text-zinc-950">
                  {useCase.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {useCase.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {useCase.examples.map((example) => (
                    <span
                      key={example}
                      className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[var(--convo-orange)]"
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </Section>
        <Section
          eyebrow="Best early targets"
          title="Start with ecommerce and service businesses. Expand into agencies."
          description="Service and ecommerce businesses usually feel the pain immediately: repeated buyer questions, missed leads, thin FAQs, and slow content production. Agencies are bigger accounts once the workflow is proven."
          tone="soft"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["Easy to understand", "The buyer problem is visible: answer questions, capture demand, publish better content."],
              ["Fast proof", "New FAQs, guides, and service page updates can show impact quickly."],
              ["Agency upside", "Once repeatable, the same workflow becomes a client growth system."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-zinc-200 bg-white p-5"
              >
                <h2 className="font-display text-xl font-bold">{title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}
