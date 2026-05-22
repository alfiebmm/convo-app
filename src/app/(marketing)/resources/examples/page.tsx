import { SimpleMarketingPage } from "@/components/marketing/page-blocks";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Examples of Website Chats Becoming SEO Content",
  description:
    "See examples of Convo turning chats into leads, FAQ updates, content recommendations, and reviewed website changes.",
  path: "/resources/examples",
  keywords: [
    "chatbot content examples",
    "website chat to blog example",
    "FAQ automation examples",
    "SEO content examples",
    "AI content workflow examples",
  ],
});

export default function ExamplesPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Examples"
      title="Show how one conversation becomes a useful action."
      description="See the chat, extracted insight, decision, and reviewed output behind each recommendation."
      blocks={[
        {
          title: "Local service enquiry",
          description: "A visitor asks about pricing and timeline. Convo answers, captures the lead, and recommends a service FAQ update.",
          items: ["Conversation excerpt", "Lead context", "FAQ update", "Service page internal link"],
        },
        {
          title: "Marketplace buyer question",
          description: "Several visitors ask the same comparison question. Convo groups them with keyword data into one buying guide recommendation.",
          items: ["Repeated topic", "Search intent", "Keyword opportunity", "SEO-optimised CMS draft"],
        },
        {
          title: "Existing answer already works",
          description: "A common question is already clearly answered. Convo recommends no new content and links to the existing page.",
          items: ["Page match", "No duplicate article", "Optional internal link", "Clear recommendation"],
        },
        {
          title: "Updated content proves value",
          description:
            "After a page update goes live, Convo tracks search and conversion signals so the business can see what moved.",
          items: ["GSC clicks", "Average position", "Content conversations", "Captured leads"],
        },
      ]}
    />
  );
}
