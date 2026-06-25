import type { MetadataRoute } from "next";
import { APP_CONFIG } from "@/config/app";

const marketingRoutes = [
  "",
  "/features",
  "/features/ai-chatbot",
  "/features/lead-capture",
  "/features/seo-content-pipeline",
  "/features/content-maintenance",
  "/features/analytics",
  "/features/cms-publishing",
  "/features/knowledge-base",
  "/how-it-works",
  "/pricing",
  "/integrations",
  "/use-cases",
  "/resources/examples",
  "/faq",
  "/compare/searchatlas",
  "/compare/opinly",
  "/contact",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return marketingRoutes.map((route) => ({
    url: new URL(route, APP_CONFIG.url).toString(),
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route.startsWith("/features") ? 0.8 : 0.7,
  }));
}
