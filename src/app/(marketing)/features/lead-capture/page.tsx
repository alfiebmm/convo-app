import { FeatureDetailPage } from "@/components/marketing/page-blocks";
import { featurePages } from "@/lib/marketing/pages";
import { marketingMetadata } from "@/lib/marketing/seo";

const page = featurePages.leadCapture;

export const metadata = marketingMetadata({
  title: "AI Chatbot Lead Capture",
  description: page.description,
  path: "/features/lead-capture",
  keywords: ["AI lead capture", "chatbot lead capture", "website lead capture", "subtle CTA chatbot"],
});

export default function Page() {
  return (
    <FeatureDetailPage
      eyebrow="Lead Capture"
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
