import { IndustryLandingPageV2 } from "@/components/marketing/industry-landing-page-v2";
import { veterinaryClinicsV2 } from "@/lib/marketing/industries-v2";
import { faqJsonLd, marketingMetadata } from "@/lib/marketing/seo";

const page = veterinaryClinicsV2;

export const metadata = marketingMetadata({
  title: page.metadataTitle,
  description: page.metadataDescription,
  path: `/resources/examples/${page.slug}/v2`,
  keywords: page.keywords,
});

export default function VeterinaryClinicsIndustryPageV2() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd(page.faqs)),
        }}
      />
      <IndustryLandingPageV2 page={page} />
    </>
  );
}
