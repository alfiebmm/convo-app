import { CTASection, MarketingLayout, Section } from "@/components/marketing/marketing-layout";
import {
  PublicResourceCard,
  resourceCategoryLabel,
} from "@/components/resources/resource-article-view";
import { ResourceSearch } from "@/components/resources/resource-search";
import type { ResourceAudience } from "@/lib/resources/content";
import {
  getArticlesByCategory,
  publicResourceArticles,
} from "@/lib/resources/content";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Convo Resources and Guides",
  description:
    "Guides to Convo's website chat, lead capture, content workflow, publishing, security, and alternatives.",
  path: "/resources",
  keywords: [
    "Convo resources",
    "AI chatbot guides",
    "chatbot lead capture",
    "chat to SEO content",
  ],
});

export default function ResourcesPage() {
  const grouped = getArticlesByCategory(publicResourceArticles);
  const categoryCardOptions: Array<{
    title: string;
    description: string;
    category: ResourceAudience;
  }> = [
    {
      title: "Product education",
      description:
        "Learn what Convo does for lean teams that need better answers, better leads, and better content without adding more busywork.",
      category: "Business owners and marketers",
    },
    {
      title: "Comparison guides",
      description:
        "Compare Convo with chat tools, support inboxes, booking forms, and SEO content software.",
      category: "Comparison and alternatives",
    },
    {
      title: "Troubleshooting",
      description:
        "Fix common website chat, content, lead capture, publishing, and setup issues.",
      category: "Troubleshooting",
    },
  ];
  const categoryCards = categoryCardOptions.filter(
    (card) => grouped[card.category]?.length > 0
  );

  return (
    <MarketingLayout>
      <main>
        <Section
          eyebrow="Resources"
          title="Guides for turning website questions into leads and better content."
          description="Learn how Convo helps time-poor businesses answer visitors, capture better enquiries, and create content from real customer questions instead of guesswork."
          headingLevel="h1"
        >
          <div className="mb-8">
            <ResourceSearch
              articles={publicResourceArticles}
              basePath="/resources"
              placeholder="Try security, booking forms, lead capture, content ideas..."
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {categoryCards.map(({ title, description, category }) => (
              <a
                key={title}
                href={`#${categoryAnchor(category)}`}
                className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
              >
                <h2 className="font-display text-xl font-bold group-hover:text-[var(--convo-orange)]">
                  {title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-zinc-600">
                  {description}
                </p>
              </a>
            ))}
          </div>
        </Section>

        {Object.entries(grouped)
          .filter(([, articles]) => articles.length > 0)
          .map(([category, articles], index) => (
            <Section
              key={category}
              id={categoryAnchor(category as ResourceAudience)}
              eyebrow="Resources"
              title={resourceCategoryLabel(category as ResourceAudience)}
              description={categoryDescription(category)}
              tone={index % 2 === 0 ? "soft" : "light"}
            >
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {articles.map((article) => (
                  <PublicResourceCard key={article.slug} article={article} />
                ))}
              </div>
            </Section>
          ))}

        <CTASection />
      </main>
    </MarketingLayout>
  );
}

function categoryDescription(category: string) {
  switch (category) {
    case "Business owners and marketers":
      return "Clear guides for small businesses, solopreneurs, agencies, and marketing teams that need useful content without wasting time or budget.";
    case "Troubleshooting":
      return "Plain-English fixes for the issues a site owner or visitor is most likely to notice.";
    case "Comparison and alternatives":
      return "Decision guides for buyers comparing Convo with chat, support, booking, and SEO content tools.";
    default:
      return "Helpful Convo guides for public readers.";
  }
}

function categoryAnchor(category: ResourceAudience) {
  switch (category) {
    case "Business owners and marketers":
      return "product-education";
    case "Comparison and alternatives":
      return "comparison-guides";
    case "Troubleshooting":
      return "troubleshooting";
    case "Customer dashboard users":
      return "setup-and-help";
    case "Public website visitors":
    default:
      return "resources";
  }
}
