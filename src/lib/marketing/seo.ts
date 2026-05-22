import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app";

type MarketingMetadata = {
  title: string;
  description: string;
  path: string;
  keywords: string[];
};

export function marketingMetadata({
  title,
  description,
  path,
  keywords,
}: MarketingMetadata): Metadata {
  const url = new URL(path, APP_CONFIG.url).toString();

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${title} | ${APP_CONFIG.name}`,
      description,
      url,
      siteName: APP_CONFIG.name,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${APP_CONFIG.name}`,
      description,
    },
  };
}
