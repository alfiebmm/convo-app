import { FeatureDetailPage } from "@/components/marketing/page-blocks";
import { featurePages } from "@/lib/marketing/pages";
import { marketingMetadata } from "@/lib/marketing/seo";

const page = featurePages.aiChatbot;

export const metadata = marketingMetadata({
  title: "AI Chatbot for Website Visitors",
  description: page.description,
  path: "/features/ai-chatbot",
  keywords: ["AI chatbot", "website chatbot", "customer support chatbot", "AI chat widget"],
});

export default function Page() {
  return (
    <FeatureDetailPage
      eyebrow="AI Chatbot"
      title={page.title}
      description={page.description}
      sections={[...page.sections]}
      positioning={page.positioning}
      differentiators={page.differentiators}
      outcomes={page.outcomes}
      conversion={page.conversion}
      competitorComparison={page.competitorComparison}
      brandedExamples={page.brandedExamples}
    />
  );
}
