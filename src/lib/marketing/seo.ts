import type { Metadata } from "next";
import { APP_CONFIG } from "@/config/app";

type MarketingMetadata = {
  title: string;
  description: string;
  path: string;
  keywords: string[];
  /** Override OG image. Defaults to /opengraph-image (Next image route). */
  image?: string;
};

export function marketingMetadata({
  title,
  description,
  path,
  keywords,
  image,
}: MarketingMetadata): Metadata {
  const url = new URL(path, APP_CONFIG.url).toString();
  const ogImage = image ?? new URL("/opengraph-image", APP_CONFIG.url).toString();

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
      locale: "en_AU",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${APP_CONFIG.name} - ${APP_CONFIG.tagline}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${APP_CONFIG.name}`,
      description,
      images: [ogImage],
    },
  };
}

/**
 * Organization schema. Surfaces founders, contact, and country so
 * Google can build a credible E-E-A-T card for the brand.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_CONFIG.name,
    legalName: `${APP_CONFIG.name} App`,
    url: APP_CONFIG.url,
    logo: new URL("/opengraph-image", APP_CONFIG.url).toString(),
    email: APP_CONFIG.support,
    foundingDate: "2026",
    founders: [
      { "@type": "Person", name: "Blake Mitchell" },
      { "@type": "Person", name: "Cameron Beach" },
    ],
    address: {
      "@type": "PostalAddress",
      addressCountry: "AU",
    },
    sameAs: [APP_CONFIG.url],
  };
}

/**
 * SoftwareApplication schema. AUD, Growth annual entry price.
 */
export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_CONFIG.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: APP_CONFIG.description,
    url: APP_CONFIG.url,
    offers: {
      "@type": "Offer",
      price: "249",
      priceCurrency: "AUD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "249",
        priceCurrency: "AUD",
        unitText: "monthly, annual billing",
      },
    },
    aggregateRating: undefined,
  };
}

/**
 * FAQPage schema from a list of question/answer pairs.
 */
export function faqJsonLd(
  items: ReadonlyArray<{ question: string; answer: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
