import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { faqGroups } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "FAQ About Convo's AI Chatbot and SEO Content Platform",
  description:
    "Answers to common questions about Convo's chatbot, lead capture, knowledge base, content pipeline, publishing, and privacy.",
  path: "/faq",
  keywords: [
    "Convo FAQ",
    "AI chatbot FAQ",
    "lead capture chatbot questions",
    "SEO content platform FAQ",
    "website chatbot answers",
  ],
});

export default function FAQPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqGroups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      }))
    ),
  };

  return (
    <MarketingLayout>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <Section
          eyebrow="FAQ"
          title="Questions about Convo?"
          description="These answers are written to double as source material for the Convo website bot."
          headingLevel="h1"
        >
          <div className="grid gap-8">
            {faqGroups.map((group) => (
              <section key={group.title}>
                <h2 className="font-display text-2xl font-bold">
                  {group.title}
                </h2>
                <div className="mt-4 grid gap-3">
                  {group.items.map((item) => (
                    <article
                      key={item.question}
                      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
                    >
                      <h3 className="font-semibold text-zinc-950">
                        {item.question}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-600">
                        {item.answer}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}
