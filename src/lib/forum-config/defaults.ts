import type { ForumConfig } from "./schema";

/**
 * Default Forum Configuration (K-01)
 * 
 * Sensible Australian-English defaults for all forum.config.json fields.
 * Used for new tenant onboarding and as a fallback for missing config values.
 * 
 * Every field in the schema has a default value defined here.
 */

export const DEFAULT_FORUM_CONFIG: ForumConfig = {
  schema_version: 1,

  ai_persona: {
    tone: "friendly",
    locale: "en-AU",
    banned_words: [],
    voice_description:
      "A helpful, friendly Australian expert who provides clear, practical advice in plain language.",
  },

  // CTA buttons are disabled by default — the chatbot weaves contextual
  // links into its response text, which is the better UX. Tenants can
  // opt in by configuring `cta_rules` in their forum config.
  // Historic placeholder rules pointing at example.com.au were stripped
  // (2026-06-05) after they leaked to live tenants who had no overrides.
  cta_rules: [],

  qualifying_questions: {
    preset: {
      question: "What brings you here today?",
      options: [
        { label: "I have a question", value: "question" },
        { label: "I need advice", value: "advice" },
        { label: "I'm looking for a service", value: "service" },
        { label: "Just browsing", value: "browsing" },
      ],
      persona_field: "visitor_intent",
    },
    additional: [],
  },

  lead_capture: {
    enabled: true,
    detection: {
      keywords: {},
    },
    notify: {
      onCapture: true,
    },
  },

  allowed_topics: [
    "general enquiries",
    "product information",
    "service details",
    "pricing",
    "support",
  ],

  exclusion_list: [
    "legal advice",
    "medical advice",
    "financial advice",
    "regulated advice",
  ],

  seo_defaults: {
    title_template: "{topic} | {site_name}",
    meta_template:
      "Expert advice on {topic}. Get clear, practical answers from Australian specialists.",
    og_image: undefined,
    schema_org_type: "Article",
  },

  connectors: {
    gsc: {
      enabled: false,
      site_url: undefined,
      refresh_token: undefined,
      access_token: undefined,
      token_expiry: undefined,
    },
    ga4: {
      enabled: false,
      property_id: undefined,
      credentials: undefined,
    },
    openai: {
      enabled: true,
      api_key: undefined,
      model: "gpt-4o",
      temperature: 0.7,
    },
  },

  limits: {
    max_output_tokens: 1500,
    max_input_tokens: 4000,
    max_history_turns: 10,
    rate_limit_per_minute: 60,
  },

  follow_up: {
    enabled: true,
    default_sensitivity: "balanced",
    allow_staff_review_flags_without_visitor_interruption: true,
    persona_source: "qualifying",
    contact_methods: [],
    capture_policies: [],
    rules: [],
    destinations: [],
  },
};
