import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarketingLayout } from "@/components/marketing/marketing-layout";
import { ResourceArticleView } from "@/components/resources/resource-article-view";
import {
  getPublicResourceArticle,
  publicResourceArticles,
} from "@/lib/resources/content";
import { APP_CONFIG } from "@/config/app";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return publicResourceArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getPublicResourceArticle(slug);
  if (!article) return {};

  const url = `${APP_CONFIG.url}/resources/${article.slug}`;

  return {
    title: `${article.title} | Convo Resources`,
    description: article.description,
    keywords: [article.primaryKeyword, ...article.secondaryKeywords],
    alternates: {
      canonical: `/resources/${article.slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.description,
      url,
      siteName: APP_CONFIG.name,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
    },
  };
}

export default async function ResourceArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getPublicResourceArticle(slug);
  if (!article) notFound();
  const publicSlugs = new Set(publicResourceArticles.map((item) => item.slug));
  const visibleArticle = {
    ...article,
    related: article.related.filter((relatedSlug) => publicSlugs.has(relatedSlug)),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": article.schema,
    headline: visibleArticle.title,
    description: visibleArticle.description,
    url: `${APP_CONFIG.url}/resources/${visibleArticle.slug}`,
    publisher: {
      "@type": "Organization",
      name: APP_CONFIG.name,
    },
    mainEntity:
      visibleArticle.schema === "FAQPage"
        ? visibleArticle.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          }))
        : undefined,
  };

  return (
    <MarketingLayout>
      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ResourceArticleView
          article={visibleArticle}
          allArticlesHref="/resources"
          allArticlesLabel="resources"
          relatedHref={(relatedSlug) => `/resources/${relatedSlug}`}
        />
      </main>
    </MarketingLayout>
  );
}
