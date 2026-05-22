import { SimpleMarketingPage } from "@/components/marketing/page-blocks";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Contact Convo for AI Chatbot and SEO Content Demos",
  description:
    "Contact Convo for demos, support, implementation questions, and CMS publishing discussions.",
  path: "/contact",
  keywords: [
    "Convo demo",
    "AI chatbot demo",
    "SEO content demo",
    "lead capture chatbot demo",
  ],
});

export default function ContactPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Contact"
      title="Talk through the right Convo setup."
      description="Get help choosing the right setup for chat, lead capture, website knowledge, SEO content, and publishing."
      blocks={[
        {
          title: "Book a demo",
          description:
            "Best for businesses that want to see lead capture, content decisions, and CMS publishing before starting.",
          items: ["Website goals", "CMS setup", "Lead routing", "Content workflow"],
        },
        {
          title: "Support or implementation",
          description:
            "Best for setup questions, integration checks, and clarifying what should be automated versus reviewed.",
          items: ["Widget install", "Knowledge sync", "Publishing adapters", "Bot behaviour"],
        },
      ]}
    />
  );
}
