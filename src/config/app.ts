/**
 * App-wide branding & configuration.
 * Change the name here when we rebrand from "Convo".
 * Every UI reference pulls from this file.
 */
export const APP_CONFIG = {
  name: "Convo",
  tagline: "Conversations that convert",
  description:
    "AI chatbot that turns website conversations into SEO-optimised content.",
  url: "https://convoapp.com.au",
  support: "support@convoapp.com.au",

  branding: {
    primary: "#FF6B2C",       // Convo Orange
    primaryLight: "#FF8F5C",  // hover
    primaryDark: "#E85A1E",   // pressed
    primarySubtle: "rgba(255,107,44,0.08)",
    background: "#FFFFFF",
    foreground: "#09090B",    // zinc-950
    muted: "#F4F4F5",         // zinc-100
    mutedForeground: "#71717A", // zinc-400
    border: "#E4E4E7",        // zinc-200
    card: "#FAFAFA",          // zinc-50
    success: "#22C55E",
    info: "#3B82F6",
    error: "#EF4444",
    warning: "#F59E0B",
  },

  fonts: {
    logo: "'Fredoka', sans-serif",
    display: "'Outfit', sans-serif",
    body: "'Inter', sans-serif",
  },

  limits: {
    starter: {
      conversationsPerMonth: 100,
      articlesPerMonth: 5,
    },
    growth: {
      conversationsPerMonth: -1, // unlimited
      articlesPerMonth: 50,
    },
    scale: {
      conversationsPerMonth: -1,
      articlesPerMonth: -1,
    },
  },
} as const;

export type AppConfig = typeof APP_CONFIG;
