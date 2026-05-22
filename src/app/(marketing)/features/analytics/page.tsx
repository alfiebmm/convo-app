import { FeatureDetailPage } from "@/components/marketing/page-blocks";
import { featurePages } from "@/lib/marketing/pages";
import { marketingMetadata } from "@/lib/marketing/seo";

const page = featurePages.analytics;

export const metadata = marketingMetadata({
  title: "SEO Performance Analytics for AI Content",
  description: page.description,
  path: "/features/analytics",
  keywords: ["SEO performance analytics", "content performance tracking", "Google Search Console content tracking", "AI content analytics"],
});

export default function Page() {
  return (
    <FeatureDetailPage
      eyebrow="SEO Performance Analytics"
      title={page.title}
      description={page.description}
      sections={[...page.sections]}
      positioning={page.positioning}
      differentiators={page.differentiators}
      outcomes={page.outcomes}
      conversion={page.conversion}
      visualExample={page.visualExample}
    />
  );
}
