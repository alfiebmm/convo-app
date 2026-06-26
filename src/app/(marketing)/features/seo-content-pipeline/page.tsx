import { FeatureDetailPage } from "@/components/marketing/page-blocks";
import { featurePages } from "@/lib/marketing/pages";
import { marketingMetadata } from "@/lib/marketing/seo";

const page = featurePages.seoPipeline;

export const metadata = marketingMetadata({
  title: "SEO Content Pipeline From Website Conversations",
  description: page.description,
  path: "/features/seo-content-pipeline",
  keywords: ["SEO content pipeline", "AI blog generator", "conversation to blog post", "SEO content automation", "AI content briefs"],
});

export default function Page() {
  return (
    <FeatureDetailPage
      eyebrow="SEO Content Pipeline"
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
