import Link from "next/link";
import {
  CTASection,
  MarketingLayout,
  Section,
} from "@/components/marketing/marketing-layout";
import { verticalUseCases } from "@/lib/marketing/content";
import { industryPages } from "@/lib/marketing/industries";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Industries That Use Convo",
  description:
    "See how Convo fits service businesses like dental clinics, veterinary clinics, and other teams that need better website enquiries.",
  path: "/resources/examples",
  keywords: [
    "Convo industries",
    "AI chatbot for service businesses",
    "AI chatbot for dentists",
    "AI chatbot for veterinary clinics",
    "website chat for clinics",
  ],
});

export default function IndustriesPage() {
  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="Industries"
          title="Industries where visitor questions become leads and content."
          description="Convo works best when people ask questions before they book, enquire, compare, or buy. Dental and veterinary clinics are strong fits, and the same loop works across service businesses, marketplaces, ecommerce, and agencies."
          headingLevel="h1"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            {industryPages.map((industry) => (
              <Link
                key={industry.slug}
                href={`/resources/examples/${industry.slug}`}
                className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
              >
                <div
                  role="img"
                  aria-label={industry.heroImage.alt}
                  className="h-48 bg-cover bg-center"
                  style={{ backgroundImage: `url(${industry.heroImage.src})` }}
                />
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--convo-orange)]">
                    {industry.eyebrow}
                  </p>
                  <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-zinc-950 group-hover:text-[var(--convo-orange)]">
                    {industry.metadataTitle}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-600">
                    {industry.description}
                  </p>
                  <p className="mt-5 text-sm font-semibold text-[var(--convo-orange)]">
                    View industry page
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          eyebrow="More use cases"
          title="The same loop works wherever customers ask before they act."
          description="If your website gets repeated questions, Convo can answer them, capture the enquiry, and show which content would help the next customer find you."
          tone="soft"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {verticalUseCases.map((vertical) => (
              <article
                key={vertical.name}
                className="relative rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <h2 className="font-display text-lg font-bold text-zinc-950">
                  {vertical.name}
                </h2>
                <p className="mt-3 text-sm italic leading-6 text-zinc-600">
                  &ldquo;{vertical.question}&rdquo;
                </p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="font-display text-2xl font-bold text-zinc-950">
              Have a customer question your website keeps missing?
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600">
              Convo is strongest when there is clear buying intent hiding in
              repeated questions: pricing, fit, availability, timing,
              locations, process, services, and what happens next.
            </p>
          </div>
        </Section>
        <CTASection />
      </main>
    </MarketingLayout>
  );
}
