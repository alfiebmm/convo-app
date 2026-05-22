import { SimpleMarketingPage } from "@/components/marketing/page-blocks";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Terms of Service",
  description: "Terms for using Convo's chatbot, lead capture, content, and publishing workflows.",
  path: "/terms",
  keywords: ["Convo terms", "AI chatbot terms", "content platform terms"],
});

export default function TermsPage() {
  return (
    <SimpleMarketingPage
      eyebrow="Legal"
      title="Terms of service."
      description="Convo helps businesses answer visitors, capture leads, generate content recommendations, and publish approved updates."
      blocks={[
        {
          title: "Service scope",
          description:
            "Convo includes chatbot, lead capture, content generation, publishing, billing, and acceptable-use workflows.",
          items: ["Customer responsibilities", "Content review", "Publishing permissions", "Plan limits"],
        },
        {
          title: "Important caution",
          description:
            "Convo improves the content workflow, but search rankings, traffic, revenue, and legal outcomes depend on factors outside the platform.",
          items: ["No ranking guarantee", "Human review", "Customer-owned approvals", "Support boundaries"],
        },
      ]}
    />
  );
}
