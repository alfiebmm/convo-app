import { FeatureDetailPage } from "@/components/marketing/page-blocks";
import { featurePages } from "@/lib/marketing/pages";
import { marketingMetadata } from "@/lib/marketing/seo";

const page = featurePages.contentMaintenance;

export const metadata = marketingMetadata({
  title: "Website Content Maintenance From Visitor Questions",
  description: page.description,
  path: "/features/content-maintenance",
  keywords: ["website content maintenance", "FAQ updates", "AI page updates", "content audit from customer questions"],
});

export default function Page() {
  return (
    <FeatureDetailPage
      eyebrow="Content Maintenance"
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
