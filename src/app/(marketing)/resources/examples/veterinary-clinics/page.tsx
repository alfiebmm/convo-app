import { IndustryLandingPage } from "@/components/marketing/industry-landing-page";
import { getIndustryPage } from "@/lib/marketing/industries";
import { faqJsonLd, marketingMetadata } from "@/lib/marketing/seo";

const page = loadPage();

export const metadata = marketingMetadata({
  title: page.metadataTitle,
  description: page.metadataDescription,
  path: `/resources/examples/${page.slug}`,
  keywords: page.keywords,
});

export default function VeterinaryClinicsIndustryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd(page.faqs)),
        }}
      />
      <IndustryLandingPage page={page} />
    </>
  );
}

function loadPage() {
  const industryPage = getIndustryPage("veterinary-clinics");

  if (!industryPage) {
    throw new Error("Missing veterinary clinics industry page");
  }

  return industryPage;
}
