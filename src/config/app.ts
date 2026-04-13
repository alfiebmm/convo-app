/**
 * App-wide branding & configuration.
 * Change the name here when we rebrand from "Convo".
 * Every UI reference pulls from this file.
 */
export const APP_CONFIG = {
  name: "Convo",
  tagline: "Conversations that rank",
  description:
    "AI chatbot that turns website conversations into SEO-optimised content.",
  url: "https://convo.app", // placeholder
  support: "hello@convo.app", // placeholder

  branding: {
    // Neutral palette — will be updated with final brand
    primary: "#0F172A", // slate-900
    secondary: "#3B82F6", // blue-500
    accent: "#10B981", // emerald-500
    background: "#FFFFFF",
    foreground: "#0F172A",
    muted: "#F1F5F9", // slate-100
    mutedForeground: "#64748B", // slate-500
    border: "#E2E8F0", // slate-200
  },

  limits: {
    starter: {
      conversationsPerMonth: 500,
      articlesPerMonth: 10,
    },
    growth: {
      conversationsPerMonth: 2000,
      articlesPerMonth: 50,
    },
    pro: {
      conversationsPerMonth: 10000,
      articlesPerMonth: 200,
    },
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
