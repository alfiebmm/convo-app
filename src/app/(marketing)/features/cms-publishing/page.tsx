import { FeatureDetailPage } from "@/components/marketing/page-blocks";
import { featurePages } from "@/lib/marketing/pages";
import { marketingMetadata } from "@/lib/marketing/seo";

const page = featurePages.cmsPublishing;

export const metadata = marketingMetadata({
  title: "CMS Publishing for AI-Generated SEO Content",
  description: page.description,
  path: "/features/cms-publishing",
  keywords: ["CMS publishing", "WordPress AI content", "Shopify blog publishing", "Webflow CMS publishing", "AI content workflow"],
});

export default function Page() {
  return (
    <FeatureDetailPage
      eyebrow="CMS Publishing"
      title={page.title}
      description={page.description}
      sections={[...page.sections]}
      positioning={page.positioning}
      differentiators={page.differentiators}
      outcomes={page.outcomes}
      conversion={page.conversion}
    />
  );
}
