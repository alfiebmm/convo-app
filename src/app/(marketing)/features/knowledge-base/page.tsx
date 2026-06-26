import { FeatureDetailPage } from "@/components/marketing/page-blocks";
import { featurePages } from "@/lib/marketing/pages";
import { marketingMetadata } from "@/lib/marketing/seo";

const page = featurePages.knowledgeBase;

export const metadata = marketingMetadata({
  title: "AI Chatbot Knowledge Base for Websites",
  description: page.description,
  path: "/features/knowledge-base",
  keywords: ["AI chatbot knowledge base", "RAG chatbot", "website knowledge base", "uploaded file chatbot"],
});

export default function Page() {
  return (
    <FeatureDetailPage
      eyebrow="Knowledge Base"
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
