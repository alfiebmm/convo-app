# Forum Config Schema (K-01)

**Linear:** CON-83  
**Purpose:** Define and document the full JSON schema for `forum.config.json` — the per-tenant configuration object that drives all chatbot and blog behaviour.

---

## Overview

The `forum.config.json` schema is stored as a JSON column on the Tenant database record. It centralizes all configuration for:

- AI persona and voice
- CTA rules and matching logic
- Qualifying questions for visitor segmentation
- Allowed and excluded topics
- SEO metadata defaults
- Third-party connector credentials
- Rate limits and token budgets

**Schema version:** 1 (versioned for future migrations)

---

## Schema Structure

### Root Fields

| Field                    | Type                          | Required | Default | Description                                                                 |
|--------------------------|-------------------------------|----------|---------|-----------------------------------------------------------------------------|
| `schema_version`         | `number`                      | Yes      | `1`     | Schema version for traceability and migration support.                      |
| `ai_persona`             | `AiPersona`                   | Yes      | —       | AI tone, locale, banned words, and voice description.                       |
| `cta_rules`              | `CtaRule[]`                   | Yes      | `[]`    | Array of CTA rules matched against thread tags.                            |
| `qualifying_questions`   | `QualifyingQuestions`         | Yes      | `{}`    | Preset + up to 4 additional questions for visitor segmentation.            |
| `allowed_topics`         | `string[]`                    | Yes      | `[]`    | Topics the chatbot can answer (whitelist).                                 |
| `exclusion_list`         | `string[]`                    | Yes      | `[]`    | Topics that block both chatbot answers and blog creation.                  |
| `seo_defaults`           | `SeoDefaults`                 | Yes      | —       | Default SEO metadata templates for blog posts.                             |
| `connectors`             | `Connectors`                  | Yes      | `{}`    | Third-party connector configurations (GSC, GA4, OpenAI).                   |
| `limits`                 | `Limits`                      | Yes      | `{}`    | Token limits and rate limiting rules.                                      |
| `follow_up`              | `FollowUp`                    | Yes      | `{}`    | Follow-up, escalation and lead-routing rules (CON-157, added Epic A1).     |

---

## Field Definitions

### `ai_persona`

Controls the chatbot's tone, language, and content filtering.

| Field              | Type       | Required | Default                                              | Description                                                                 |
|--------------------|------------|----------|------------------------------------------------------|-----------------------------------------------------------------------------|
| `tone`             | `enum`     | Yes      | `"friendly"`                                         | Chatbot tone. Options: `professional`, `friendly`, `casual`, `expert`, `empathetic`. |
| `locale`           | `string`   | Yes      | `"en-AU"`                                            | Language and regional variant (e.g., `en-AU`, `en-US`, `en-GB`).            |
| `banned_words`     | `string[]` | Yes      | `[]`                                                 | Words to strip from all chatbot responses before sending.                   |
| `voice_description`| `string`   | Yes      | `"A helpful, friendly Australian expert..."`         | Natural language description of the AI persona. Used in system prompts.     |

**Example:**

```json
{
  "tone": "professional",
  "locale": "en-AU",
  "banned_words": ["guaranteed", "always", "never"],
  "voice_description": "A knowledgeable Australian agricultural advisor who provides evidence-based, practical advice in clear language."
}
```

**Validation Rules:**
- `tone` must be one of the five allowed values.
- `locale` must be a valid locale string (no format validation enforced yet).
- `banned_words` is an array of strings; empty array is valid.
- `voice_description` can be any string.

---

### `cta_rules`

An array of call-to-action rules. Each CTA is matched against the thread's primary tag.

| Field     | Type      | Required | Default | Description                                                                 |
|-----------|-----------|----------|---------|-----------------------------------------------------------------------------|
| `tag`     | `string`  | Yes      | —       | The thread tag this CTA applies to (e.g., `"pricing"`, `"general"`).       |
| `text`    | `string`  | Yes      | —       | The CTA button text.                                                        |
| `url`     | `string`  | Yes      | —       | The CTA destination URL (must be a valid URL).                              |
| `default` | `boolean` | Yes      | `false` | If `true`, this CTA is used when no tag-specific match is found.           |

**Example:**

```json
[
  {
    "tag": "pricing",
    "text": "Get a Custom Quote",
    "url": "https://example.com.au/contact",
    "default": false
  },
  {
    "tag": "general",
    "text": "Learn More",
    "url": "https://example.com.au/learn-more",
    "default": true
  }
]
```

**Validation Rules:**
- Each rule must have a `tag`, `text`, and `url`.
- `url` must be a valid URL (validated by Zod's `.url()` method).
- Only one CTA should have `default: true` (not enforced at schema level; application logic should handle this).

---

### `qualifying_questions`

Questions asked to identify visitor persona before the first free-text response.

| Field        | Type                       | Required | Default | Description                                                                 |
|--------------|----------------------------|----------|---------|-----------------------------------------------------------------------------|
| `preset`     | `QualifyingQuestion?`      | No       | —       | The first qualifying question (optional).                                   |
| `additional` | `QualifyingQuestion[]`     | Yes      | `[]`    | Up to 4 additional questions (enforced by schema).                          |

**QualifyingQuestion structure:**

| Field           | Type                  | Required | Description                                                                 |
|-----------------|-----------------------|----------|-----------------------------------------------------------------------------|
| `question`      | `string`              | Yes      | The question text (e.g., "What brings you here today?").                    |
| `options`       | `QuestionOption[]`    | Yes      | Array of answer options.                                                    |
| `persona_field` | `string`              | Yes      | The persona field name to store the selected answer (e.g., `visitor_intent`).|

**QuestionOption structure:**

| Field   | Type     | Required | Description                                                                 |
|---------|----------|----------|-----------------------------------------------------------------------------|
| `label` | `string` | Yes      | The option label shown to the visitor (e.g., "I have a question").          |
| `value` | `string` | Yes      | The stored value for this option (e.g., `"question"`).                      |

**Example:**

```json
{
  "preset": {
    "question": "What brings you here today?",
    "options": [
      { "label": "I have a question", "value": "question" },
      { "label": "I need advice", "value": "advice" },
      { "label": "I'm looking for a service", "value": "service" }
    ],
    "persona_field": "visitor_intent"
  },
  "additional": [
    {
      "question": "What type of property do you have?",
      "options": [
        { "label": "Residential", "value": "residential" },
        { "label": "Commercial", "value": "commercial" },
        { "label": "Rural", "value": "rural" }
      ],
      "persona_field": "property_type"
    }
  ]
}
```

**Validation Rules:**
- `preset` is optional.
- `additional` is an array with a maximum of 4 items (enforced by `.max(4)`).
- Each question must have `question`, `options`, and `persona_field`.

---

### `allowed_topics`

An array of topic strings the chatbot is permitted to answer.

**Example:**

```json
[
  "general enquiries",
  "product information",
  "service details",
  "pricing",
  "support"
]
```

**Validation Rules:**
- Array of strings.
- No length limit.
- Empty array is valid (means no topic restriction).

---

### `exclusion_list`

Topics that block both chatbot answers and blog creation.

**Example:**

```json
[
  "legal advice",
  "medical advice",
  "financial advice",
  "regulated advice"
]
```

**Validation Rules:**
- Array of strings.
- No length limit.
- Empty array is valid (means no exclusions).

---

### `seo_defaults`

Default SEO metadata templates for blog posts.

| Field              | Type     | Required | Default                                   | Description                                                                 |
|--------------------|----------|----------|-------------------------------------------|-----------------------------------------------------------------------------|
| `title_template`   | `string` | Yes      | `"{topic} \| {site_name}"`                | Template for meta title. Placeholders: `{topic}`, `{site_name}`.            |
| `meta_template`    | `string` | Yes      | `"Expert advice on {topic}..."`           | Template for meta description. Placeholder: `{topic}`.                      |
| `og_image`         | `string` | No       | `undefined`                               | Default Open Graph image URL. Must be a valid URL if provided.             |
| `schema_org_type`  | `enum`   | Yes      | `"Article"`                               | Default schema.org type. Options: `Article`, `BlogPosting`, `QAPage`, `HowTo`, `FAQPage`. |

**Example:**

```json
{
  "title_template": "{topic} | AgPages",
  "meta_template": "Expert Australian agricultural advice on {topic}. Get clear, practical answers.",
  "og_image": "https://agpages.com.au/og-default.jpg",
  "schema_org_type": "BlogPosting"
}
```

**Validation Rules:**
- `title_template` and `meta_template` are required strings.
- `og_image` must be a valid URL if provided (optional).
- `schema_org_type` must be one of the five allowed values.

---

### `connectors`

Third-party connector configurations.

| Field    | Type              | Required | Default | Description                                                                 |
|----------|-------------------|----------|---------|-----------------------------------------------------------------------------|
| `gsc`    | `GscConnector`    | Yes      | `{}`    | Google Search Console connector.                                            |
| `ga4`    | `Ga4Connector`    | Yes      | `{}`    | Google Analytics 4 connector.                                               |
| `openai` | `OpenaiConnector` | Yes      | `{}`    | OpenAI API connector.                                                       |

#### `gsc` (Google Search Console)

| Field           | Type      | Required | Default | Description                                                                 |
|-----------------|-----------|----------|---------|-----------------------------------------------------------------------------|
| `enabled`       | `boolean` | Yes      | `false` | Whether the connector is active.                                            |
| `site_url`      | `string`  | No       | —       | The verified site URL in GSC (e.g., `"https://example.com.au"`).            |
| `refresh_token` | `string`  | No       | —       | OAuth refresh token (encrypted in production).                              |
| `access_token`  | `string`  | No       | —       | OAuth access token (short-lived).                                           |
| `token_expiry`  | `string`  | No       | —       | ISO 8601 datetime string for token expiry.                                  |

#### `ga4` (Google Analytics 4)

| Field         | Type      | Required | Default | Description                                                                 |
|---------------|-----------|----------|---------|-----------------------------------------------------------------------------|
| `enabled`     | `boolean` | Yes      | `false` | Whether the connector is active.                                            |
| `property_id` | `string`  | No       | —       | The GA4 property ID (e.g., `"123456789"`).                                  |
| `credentials` | `string`  | No       | —       | JSON service account credentials (encrypted in production).                 |

#### `openai` (OpenAI API)

| Field         | Type      | Required | Default    | Description                                                                 |
|---------------|-----------|----------|------------|-----------------------------------------------------------------------------|
| `enabled`     | `boolean` | Yes      | `true`     | Whether the connector is active.                                            |
| `api_key`     | `string`  | No       | —          | OpenAI API key (encrypted in production).                                   |
| `model`       | `string`  | Yes      | `"gpt-4o"` | The model to use (e.g., `"gpt-4o"`, `"gpt-4-turbo"`).                       |
| `temperature` | `number`  | Yes      | `0.7`      | Sampling temperature (0.0–2.0). Lower = more deterministic.                 |

**Example:**

```json
{
  "gsc": {
    "enabled": true,
    "site_url": "https://agpages.com.au",
    "refresh_token": "...",
    "access_token": "...",
    "token_expiry": "2026-05-08T10:00:00Z"
  },
  "ga4": {
    "enabled": false
  },
  "openai": {
    "enabled": true,
    "api_key": "sk-...",
    "model": "gpt-4o",
    "temperature": 0.7
  }
}
```

**Validation Rules:**
- `enabled` is a boolean (default `false` for GSC/GA4, `true` for OpenAI).
- `site_url` must be a valid URL if provided.
- `temperature` must be between 0 and 2 (inclusive).
- All credential fields are optional strings.

---

### `limits`

Token limits and rate limiting rules.

| Field                  | Type     | Required | Default | Description                                                                 |
|------------------------|----------|----------|---------|-----------------------------------------------------------------------------|
| `max_output_tokens`    | `number` | Yes      | `1500`  | Maximum tokens in a single chatbot response.                                |
| `max_input_tokens`     | `number` | Yes      | `4000`  | Maximum tokens in the input context (including message history).            |
| `max_history_turns`    | `number` | Yes      | `10`    | Maximum number of conversation turns to include in context.                 |
| `rate_limit_per_minute`| `number` | Yes      | `60`    | Maximum chatbot requests per minute per visitor.                            |

**Example:**

```json
{
  "max_output_tokens": 2000,
  "max_input_tokens": 5000,
  "max_history_turns": 15,
  "rate_limit_per_minute": 100
}
```

**Validation Rules:**
- All fields are positive integers (enforced by `.int().positive()`).
- Default values are sensible for most use cases.

---

### `follow_up`

Governs when the chatbot escalates, when it captures contact details, and where qualified cases go. The schema is the foundation of the Configurable Follow-Up, Escalation and Lead Routing program (CON-149) — Epic B (orchestration), C (UI), D (connectors), E (inbox), F (metrics), G (config UI) all reference these shapes.

Added in CON-157 (Epic A1). PRD: `2026-05-31-convo-configurable-follow-up-prd_1` §8–§10.

| Field                                                       | Type                | Required | Default        | Description                                                                                                                  |
|-------------------------------------------------------------|---------------------|----------|----------------|------------------------------------------------------------------------------------------------------------------------------|
| `enabled`                                                   | `boolean`           | Yes      | `true`         | Master switch. When `false`, no follow-up rule fires.                                                                        |
| `default_sensitivity`                                       | `enum`              | Yes      | `"balanced"`   | Tenant-level baseline. One of `conservative`, `balanced`, `proactive` (PRD §8).                                              |
| `allow_staff_review_flags_without_visitor_interruption`     | `boolean`           | Yes      | `true`         | Whether `flag_for_staff_review_without_interrupting_visitor` action is allowed (PRD §8).                                     |
| `persona_source`                                            | `literal`           | Yes      | `"qualifying"` | Source of persona data. Pinned to `"qualifying"` (CON-94's `qualifying_questions`) in V1; literal for forward compatibility. |
| `contact_methods`                                           | `ContactMethod[]`   | Yes      | `[]`           | Approved methods Convo can refer visitors to (email, phone, callback, url, form).                                            |
| `capture_policies`                                          | `CapturePolicy[]`   | Yes      | `[]`           | Field lists, privacy notice and policy URL for each capture flow (PRD §10).                                                  |
| `rules`                                                     | `FollowUpRule[]`    | Yes      | `[]`           | Conditions → action mappings. Evaluated server-side at runtime by Epic B.                                                    |
| `destinations`                                              | `Destination[]`     | Yes      | `[]`           | Where Convo delivers qualified cases. Linked to rules via `routing_key`.                                                     |

#### `ContactMethod`

| Field           | Type                                                      | Required          | Description                                                                              |
|-----------------|-----------------------------------------------------------|-------------------|------------------------------------------------------------------------------------------|
| `id`            | `string`                                                  | Yes               | Stable id, referenced by `rule.contact_method_id`.                                       |
| `type`          | `enum(email, phone, callback, url, form)`                 | Yes               | Method type.                                                                             |
| `label`         | `string`                                                  | Yes               | Visitor-facing label.                                                                    |
| `value`         | `string`                                                  | Required for `email`/`phone` | The address or number.                                                          |
| `url`           | `string` (URL)                                            | Required for `url`/`form`    | The destination URL.                                                            |
| `available_for` | `CaseType[]`                                              | Yes (min 1)       | Which case types this method serves: `cx_support`, `lead`.                               |

#### `CapturePolicy`

| Field                | Type                  | Required | Description                                                                              |
|----------------------|-----------------------|----------|------------------------------------------------------------------------------------------|
| `id`                 | `string`              | Yes      | Stable id, referenced by `rule.capture_policy_id`.                                       |
| `case_type`          | `CaseType`            | Yes      | Must match the rule's `case_type` that references it.                                    |
| `required_fields`    | `FieldKey[]`          | Yes      | Field-key registry: `name`, `email`, `mobile`, `postcode`, `suburb`, `state`, `company`, `free_text_note`, `preferred_contact_method`, plus tenant-defined custom keys. |
| `optional_fields`    | `FieldKey[]`          | Yes      | Same registry.                                                                           |
| `privacy_notice`     | `string`              | Yes      | Shown to visitor at the point of capture.                                                |
| `privacy_policy_url` | `string` (URL)        | Yes      | Linked from the notice.                                                                  |

#### `FollowUpRule`

| Field                  | Type                  | Required             | Default     | Description                                                       |
|------------------------|-----------------------|----------------------|-------------|-------------------------------------------------------------------|
| `id`                   | `string`              | Yes                  | —           | Stable id.                                                        |
| `name`                 | `string`              | Yes                  | —           | Human-readable label.                                             |
| `case_type`            | `CaseType`            | Yes                  | —           | `cx_support` or `lead`.                                           |
| `enabled`              | `boolean`             | Yes                  | `true`      | Per-rule kill switch.                                             |
| `priority`             | `enum(low/normal/high)` | Yes                | `"normal"`  | Conflict-resolution hint for Epic B.                              |
| `confidence_threshold` | `number` (0–1)        | Yes                  | `0.7`       | Minimum model confidence for the rule to fire.                    |
| `when`                 | `RuleCondition`       | Yes                  | `{}`        | All-optional, AND-evaluated condition block (see below).          |
| `action`               | `ActionMode`          | Yes                  | —           | One of the 7 PRD §8 modes.                                        |
| `capture_policy_id`    | `string`              | Action-dependent     | —           | See action-dependency table below.                                |
| `contact_method_id`    | `string`              | Action-dependent     | —           | See action-dependency table below.                                |
| `routing_key`          | `string`              | Yes                  | —           | Connects rule output to `destinations[].routing_key`.             |

**Action-mode dependencies (cross-field validation):**

| Action mode                                              | `capture_policy_id` | `contact_method_id` |
|----------------------------------------------------------|---------------------|---------------------|
| `continue_helping`                                       | must NOT have       | must NOT have       |
| `clarify_then_recheck`                                   | must NOT have       | must NOT have       |
| `offer_follow_up`                                        | **required**        | must NOT have       |
| `refer_to_approved_contact_method`                       | must NOT have       | **required**        |
| `capture_details_then_flag`                              | **required**        | must NOT have       |
| `flag_for_staff_review_without_interrupting_visitor`     | must NOT have       | must NOT have       |
| `immediate_escalation`                                   | optional            | optional            |

#### `RuleCondition`

All fields optional. When present, evaluated as a logical AND. An empty `when: {}` matches every conversation.

- `persona_in: string[]`
- `intent_in: string[]`
- `topic_in: string[]`
- `exclude_topics: string[]`
- `sentiment_in: string[]`
- `urgency_in: string[]`
- `marketplace_side_in: string[]`
- `page_url_pattern: string` (regex, applied at runtime by Epic B)
- `repeated_loop_count_gte: number`
- `unanswered_confidence_lte: number` (0–1)
- `direct_human_request: boolean`
- `location_in: string[]`
- `product_or_service_in: string[]`

#### `Destination`

| Field         | Type                          | Required | Description                                                          |
|---------------|-------------------------------|----------|----------------------------------------------------------------------|
| `id`          | `string`                      | Yes      | Stable id.                                                           |
| `case_type`   | `CaseType`                    | Yes      | Must be referenced by at least one rule of the same case_type.       |
| `connector`   | `enum(webhook, csv_export)`   | Yes      | V1 connectors only. `hubspot`/`zendesk`/`salesforce` are Epic D.     |
| `routing_key` | `string`                      | Yes      | Matches rule output. Multiple rules can share a routing_key.         |
| `config`      | `Record<string, unknown>`     | No       | Connector-specific config (e.g. webhook URL, secret).                |

**Top-level reference linkage (validated at `followUpSchema` level):**

- Every `rule.capture_policy_id` must exist in `capture_policies[]` AND its `case_type` must match the rule's `case_type`.
- Every `rule.contact_method_id` must exist in `contact_methods[]` AND its `available_for` must include the rule's `case_type`.
- Every `destination.case_type` must be referenced by at least one rule of that case_type (dangling destinations are config rot — error, not warning).

**Example (PRD §9):**

```json
{
  "follow_up": {
    "enabled": true,
    "default_sensitivity": "balanced",
    "allow_staff_review_flags_without_visitor_interruption": true,
    "contact_methods": [
      {
        "id": "support_email",
        "type": "email",
        "label": "Email our support team",
        "value": "support@example.com.au",
        "available_for": ["cx_support"]
      }
    ],
    "capture_policies": [
      {
        "id": "lead_callback",
        "case_type": "lead",
        "required_fields": ["name", "mobile"],
        "optional_fields": ["email", "postcode"],
        "privacy_notice": "We'll share these details with Example Co so they can respond to your enquiry.",
        "privacy_policy_url": "https://example.com.au/privacy"
      }
    ],
    "rules": [
      {
        "id": "farmer_service_request",
        "name": "Farmer requesting a contractor",
        "case_type": "lead",
        "enabled": true,
        "priority": "normal",
        "confidence_threshold": 0.75,
        "when": {
          "persona_in": ["farmer"],
          "intent_in": ["find_contractor", "request_quote"],
          "exclude_topics": ["general_research"]
        },
        "action": "capture_details_then_flag",
        "capture_policy_id": "lead_callback",
        "routing_key": "marketplace_demand"
      }
    ],
    "destinations": [
      {
        "id": "default_leads",
        "case_type": "lead",
        "connector": "webhook",
        "routing_key": "marketplace_demand"
      }
    ]
  }
}
```

---

## Usage

### Validating a Config

```typescript
import { validateForumConfig } from "@/lib/forum-config/validate";

const result = validateForumConfig(userInput);
if (result.ok) {
  // result.data is typed as ForumConfig
  await updateTenantConfig(tenantId, result.data);
} else {
  console.error("Validation errors:", result.errors);
}
```

### Loading with Default Fallback

```typescript
import { parseForumConfigSafe } from "@/lib/forum-config/validate";
import { DEFAULT_FORUM_CONFIG } from "@/lib/forum-config/defaults";

const config = parseForumConfigSafe(tenant.settings, DEFAULT_FORUM_CONFIG);
```

### Type-Safe Access

```typescript
import type { ForumConfig } from "@/lib/forum-config/types";

function applyAiPersona(config: ForumConfig) {
  const { tone, locale, banned_words } = config.ai_persona;
  // TypeScript knows the exact shape
}
```

---

## K-02 Wiring Notes

**For K-02 (Tenant Database Model):**

1. **Tenant table already exists** (`src/lib/db/schema.ts`).
2. **Config column:** The table has a `settings` jsonb column (not `config`). K-02 must decide:
   - **Option A:** Rename `settings` → `config` (requires a migration).
   - **Option B:** Use `settings` as-is for `forum.config.json` storage.
3. **Validation:** Add a validation layer in the Tenant CRUD API to call `validateForumConfig()` before every write.
4. **Default config:** On tenant creation, populate `settings` (or `config`) with `DEFAULT_FORUM_CONFIG`.
5. **API response:** Expose the config via a typed API endpoint that returns `ForumConfig` (validated + parsed).
6. **Schema version:** Store `schema_version: 1` on every config. Future migrations can check this field and transform old configs.

**Migration note:** If K-02 renames `settings` → `config`, the migration SQL should be:

```sql
ALTER TABLE tenants RENAME COLUMN settings TO config;
```

**No migration needed if using `settings` as-is.**

---

## Testing

See `__tests__/schema.test.ts` for validation tests.

Run the sanity test:

```bash
npm run validate:config
```

Or directly:

```bash
node scripts/validate-forum-config.mjs
```

Follow-up schema tests (CON-157):

```bash
npx tsx src/lib/forum-config/__tests__/follow-up.test.ts
```

---

## Change Log

| Version | Date       | Description                                                                      |
|---------|------------|----------------------------------------------------------------------------------|
| 1       | 2026-05-07 | Initial schema definition (K-01).                                                |
| 1       | 2026-05-31 | Added `follow_up` block (CON-157, Epic A1 — additive, no schema_version bump).   |
