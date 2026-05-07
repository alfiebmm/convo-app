import { z } from "zod";

/**
 * forum.config.json Schema (K-01)
 * 
 * This is the per-tenant configuration object that drives all chatbot and blog behaviour.
 * Store as a JSON column on the Tenant DB record. Validate on every write.
 * 
 * @see README.md for detailed field documentation
 */

// ============================================================
// AI Persona Configuration
// ============================================================

export const aiPersonaSchema = z.object({
  tone: z.enum(["professional", "friendly", "casual", "expert", "empathetic"]),
  locale: z.string().default("en-AU"),
  banned_words: z.array(z.string()).default([]),
  voice_description: z.string().default(""),
});

// ============================================================
// CTA Rules Configuration
// ============================================================

export const ctaRuleSchema = z.object({
  tag: z.string(),
  text: z.string(),
  url: z.string().url(),
  default: z.boolean().default(false),
});

export const ctaRulesSchema = z.array(ctaRuleSchema).default([]);

// ============================================================
// Qualifying Questions Configuration
// ============================================================

export const questionOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const qualifyingQuestionSchema = z.object({
  question: z.string(),
  options: z.array(questionOptionSchema),
  persona_field: z.string(),
});

export const qualifyingQuestionsSchema = z.object({
  preset: qualifyingQuestionSchema.optional(),
  additional: z.array(qualifyingQuestionSchema).max(4).default([]),
});

// ============================================================
// Topic Configuration
// ============================================================

export const allowedTopicsSchema = z.array(z.string()).default([]);
export const exclusionListSchema = z.array(z.string()).default([]);

// ============================================================
// SEO Defaults Configuration
// ============================================================

export const seoDefaultsSchema = z.object({
  title_template: z.string(),
  meta_template: z.string(),
  og_image: z.string().url().optional(),
  schema_org_type: z.enum([
    "Article",
    "BlogPosting",
    "QAPage",
    "HowTo",
    "FAQPage",
  ]),
});

// ============================================================
// Connector Configurations
// ============================================================

export const gscConnectorSchema = z.object({
  enabled: z.boolean().default(false),
  site_url: z.string().url().optional(),
  refresh_token: z.string().optional(),
  access_token: z.string().optional(),
  token_expiry: z.string().datetime().optional(),
});

export const ga4ConnectorSchema = z.object({
  enabled: z.boolean().default(false),
  property_id: z.string().optional(),
  credentials: z.string().optional(), // JSON service account credentials
});

export const openaiConnectorSchema = z.object({
  enabled: z.boolean().default(true),
  api_key: z.string().optional(),
  model: z.string().default("gpt-4o"),
  temperature: z.number().min(0).max(2).default(0.7),
});

export const connectorsSchema = z.object({
  gsc: gscConnectorSchema.prefault({}),
  ga4: ga4ConnectorSchema.prefault({}),
  openai: openaiConnectorSchema.prefault({}),
});

// ============================================================
// Limits Configuration
// ============================================================

export const limitsSchema = z.object({
  max_output_tokens: z.number().int().positive().default(1500),
  max_input_tokens: z.number().int().positive().default(4000),
  max_history_turns: z.number().int().positive().default(10),
  rate_limit_per_minute: z.number().int().positive().default(60),
});

// ============================================================
// Root Forum Config Schema
// ============================================================

export const forumConfigSchema = z.object({
  schema_version: z.number().int().positive().default(1),
  ai_persona: aiPersonaSchema,
  cta_rules: ctaRulesSchema,
  qualifying_questions: qualifyingQuestionsSchema.prefault({}),
  allowed_topics: allowedTopicsSchema,
  exclusion_list: exclusionListSchema,
  seo_defaults: seoDefaultsSchema,
  connectors: connectorsSchema.prefault({}),
  limits: limitsSchema.prefault({}),
});

// ============================================================
// Inferred TypeScript Type
// ============================================================

export type ForumConfig = z.infer<typeof forumConfigSchema>;
export type AiPersona = z.infer<typeof aiPersonaSchema>;
export type CtaRule = z.infer<typeof ctaRuleSchema>;
export type QualifyingQuestion = z.infer<typeof qualifyingQuestionSchema>;
export type SeoDefaults = z.infer<typeof seoDefaultsSchema>;
export type Connectors = z.infer<typeof connectorsSchema>;
export type Limits = z.infer<typeof limitsSchema>;
