import type { MetadataRoute } from "next";
import { APP_CONFIG } from "@/config/app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/api", "/login", "/onboarding"],
    },
    sitemap: new URL("/sitemap.xml", APP_CONFIG.url).toString(),
  };
}
