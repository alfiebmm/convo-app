import { notFound } from "next/navigation";
import { ResourceArticleView } from "@/components/resources/resource-article-view";
import {
  dashboardHelpArticles,
  getDashboardHelpArticle,
} from "@/lib/resources/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return dashboardHelpArticles.map((article) => ({ slug: article.slug }));
}

export default async function DashboardHelpArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getDashboardHelpArticle(slug);
  if (!article) notFound();
  const dashboardSlugs = new Set(dashboardHelpArticles.map((item) => item.slug));
  const visibleArticle = {
    ...article,
    related: article.related.filter((relatedSlug) => dashboardSlugs.has(relatedSlug)),
  };

  return (
    <div className="-m-8 bg-slate-50">
      <ResourceArticleView
        article={visibleArticle}
        allArticlesHref="/dashboard/help"
        allArticlesLabel="help"
        relatedHref={(relatedSlug) => `/dashboard/help/${relatedSlug}`}
      />
    </div>
  );
}
