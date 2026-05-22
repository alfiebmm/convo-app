import Link from "next/link";
import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { featureCards } from "@/lib/marketing/content";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Features for AI Chat, Lead Capture, and SEO Content",
  description:
    "Explore Convo features for AI chat, lead capture, SEO content, website updates, knowledge grounding, and CMS publishing.",
  path: "/features",
  keywords: [
    "AI chatbot features",
    "AI lead capture",
    "SEO content pipeline",
    "CMS publishing",
    "website content updates",
  ],
});

export default function FeaturesPage() {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="Features"
          title="One platform for chat, leads, insight, and content."
          description="Answer visitors, capture qualified leads, find content opportunities, and publish SEO-optimised updates from one workflow."
          headingLevel="h1"
        >
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-200"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                  {feature.eyebrow}
                </p>
                <h2 className="mt-3 font-display text-2xl font-bold">
                  {feature.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {feature.description}
                </p>
              </Link>
            ))}
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}
