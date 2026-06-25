import { SimpleMarketingPage } from "@/components/marketing/page-blocks";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Privacy and Data Handling",
  description:
    "How Convo handles website conversations, lead details, uploaded knowledge, and content workflows.",
  path: "/privacy",
  keywords: ["Convo privacy", "AI chatbot privacy", "website chat data"],
});

export default function PrivacyPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Legal"
      title="Privacy and data handling."
      description="Convo uses customer data to power chat, lead capture, knowledge retrieval, content recommendations, and publishing workflows."
      blocks={[
        {
          title: "Data use",
          description:
            "Convo uses customer website and conversation data to operate chatbot, lead capture, knowledge, and content workflows.",
          items: ["Conversation messages", "Lead details", "Website content", "Uploaded knowledge files"],
        },
        {
          title: "Trust and controls",
          description:
            "Customers can see what data is used, control knowledge sources, and review content before publishing.",
          items: ["Tenant separation", "Knowledge source controls", "Content review", "Responsible data handling"],
        },
      ]}
    />
  );
}
