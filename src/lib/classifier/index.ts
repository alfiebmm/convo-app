/**
 * Conversation classifier (CON-165, Epic C1).
 *
 * LLM secondary-pass classifier that produces structured `ClassifierOutput`
 * for every conversation snapshot. Consumed by C2 (CON-166) deterministic
 * rule evaluator; hooked into `/api/chat` by C3 (CON-167).
 *
 * Architectural notes (carry-forward from CON-93 + CON-98):
 *   - The classifier NEVER sees CTA URLs, contact addresses, capture
 *     policies, connector secrets, or any other internal tenant config.
 *     The function signature only accepts the three vocab-bearing slices
 *     of `ForumConfig` (`ai_persona`, `qualifying_questions`,
 *     `allowed_topics`) — leakage is structurally impossible.
 *   - Visitor messages are safe-wrapped in `<visitor_msg>` tags with
 *     closing-tag neutralisation before insertion into the prompt.
 *   - Output is validated against the Zod schema BEFORE return. On any
 *     failure (LLM error, JSON parse fail, schema validation fail) the
 *     function returns `safeDefaultClassifierOutput()` and NEVER throws.
 *
 * Storage: this module ships as a pure function. Persistence to
 * `follow_up_case_attributes` will land via B5 helpers under Epic B
 * (CON-151), currently P0-blocked. The stub `persistClassifierOutput()`
 * below documents the future signature.
 */

import OpenAI from "openai";
import type { ForumConfig } from "@/lib/forum-config/schema";
import {
  buildClassifierPrompt,
  type ClassifierMessage,
} from "./prompt";
import {
  classifierOutputSchema,
  safeDefaultClassifierOutput,
  type ClassifierOutput,
} from "./schema";

const CLASSIFIER_MODEL = "gpt-4o-mini";
const CLASSIFIER_MAX_TOKENS = 500;
const CLASSIFIER_TEMPERATURE = 0;

/**
 * Subset of `ForumConfig` the classifier is allowed to see. By keeping this
 * an explicit `Pick<>`, the type system enforces the "classifier never sees
 * connector data" invariant.
 */
export type ClassifierTenantConfig = Pick<
  ForumConfig,
  "ai_persona" | "qualifying_questions" | "allowed_topics"
>;

export interface ClassifyConversationInput {
  /** Tenant scope. Used for logging only — never sent to the model. */
  tenantId: string;
  /** Conversation scope. Used for logging only — never sent to the model. */
  conversationId: string;
  messages: ClassifierMessage[];
  tenantConfig: ClassifierTenantConfig;
  /**
   * Optional OpenAI client override (testing). Production callers should
   * leave this undefined to use the default `getOpenAI()` factory.
   */
  openaiClient?: OpenAI;
  /** Override the chat-completions model. Defaults to `gpt-4o-mini`. */
  model?: string;
}

export interface ClassifyConversationResult {
  output: ClassifierOutput;
  /** True if the classifier returned a real model output. */
  ok: boolean;
  /** Set when `ok=false` — single short tag for logging. */
  degradedReason?:
    | "openai_error"
    | "empty_response"
    | "json_parse_failed_twice"
    | "schema_validation_failed";
}

/**
 * Lazy default OpenAI client factory. Mirrors the inline pattern used by
 * `src/app/api/chat/route.ts` and the pipeline modules.
 */
function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new OpenAI({ apiKey });
}

/**
 * Classify a conversation snapshot. Never throws — on any failure (LLM
 * error, JSON parse fail twice, schema validation fail), returns the safe
 * default output with `ok: false` and a `degradedReason` tag.
 */
export async function classifyConversation(
  input: ClassifyConversationInput,
): Promise<ClassifyConversationResult> {
  const { messages, tenantConfig, openaiClient, model } = input;
  const { system, user } = buildClassifierPrompt({ messages, tenantConfig });
  const client = openaiClient ?? getOpenAI();
  const chosenModel = model ?? CLASSIFIER_MODEL;

  // Attempt 1: standard call.
  let raw: string | null = null;
  try {
    raw = await callOnce(client, chosenModel, system, user);
  } catch (err) {
    logDegradation(input, "openai_error", err);
    return { output: safeDefaultClassifierOutput(), ok: false, degradedReason: "openai_error" };
  }

  if (!raw || raw.trim().length === 0) {
    logDegradation(input, "empty_response", null);
    return { output: safeDefaultClassifierOutput(), ok: false, degradedReason: "empty_response" };
  }

  let parsed = tryParseJson(raw);

  // Attempt 2: retry with explicit "JSON only" reminder.
  if (parsed === null) {
    try {
      const retryUser =
        user +
        "\n\nYour previous output was not valid JSON. Output ONLY the JSON object, no prose.";
      const retryRaw = await callOnce(client, chosenModel, system, retryUser);
      parsed = retryRaw ? tryParseJson(retryRaw) : null;
    } catch (err) {
      logDegradation(input, "openai_error", err);
      return { output: safeDefaultClassifierOutput(), ok: false, degradedReason: "openai_error" };
    }
  }

  if (parsed === null) {
    logDegradation(input, "json_parse_failed_twice", null);
    return {
      output: safeDefaultClassifierOutput(),
      ok: false,
      degradedReason: "json_parse_failed_twice",
    };
  }

  const validated = classifierOutputSchema.safeParse(parsed);
  if (!validated.success) {
    logDegradation(input, "schema_validation_failed", validated.error);
    return {
      output: safeDefaultClassifierOutput(),
      ok: false,
      degradedReason: "schema_validation_failed",
    };
  }

  return { output: validated.data, ok: true };
}

async function callOnce(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
): Promise<string | null> {
  const completion = await client.chat.completions.create({
    model,
    temperature: CLASSIFIER_TEMPERATURE,
    max_tokens: CLASSIFIER_MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return completion.choices[0]?.message?.content ?? null;
}

function tryParseJson(raw: string): unknown {
  // Strip accidental markdown fences if the model emits any despite the
  // contract — defensive only; json-mode should prevent this.
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function logDegradation(
  input: { tenantId: string; conversationId: string },
  reason: string,
  err: unknown,
): void {
  // Lightweight structured log. The hosting environment (Vercel) collects
  // stdout for downstream analysis.
  const message =
    err instanceof Error ? err.message : err === null ? null : String(err);
  console.warn(
    `[classifier] degraded tenant=${input.tenantId} conversation=${input.conversationId} reason=${reason}` +
      (message ? ` err=${message}` : ""),
  );
}

// ---------------------------------------------------------------------------
// Storage stub — Epic B / B5 (CON-151) blocked
// ---------------------------------------------------------------------------

export interface PersistClassifierOutputInput {
  tenantId: string;
  conversationId: string;
  output: ClassifierOutput;
}

/**
 * TODO(B5): persist to `follow_up_case_attributes` via the storage helpers
 * landing under Epic B (CON-151). Epic B is currently blocked by a P0
 * (per the install handover). When B5 ships, this stub gets replaced with
 * a thin wrapper around the helper.
 *
 * Until then, calling this throws — it should not be wired into any
 * production code path. The classifier itself is consumed as a pure
 * function via `classifyConversation()`.
 */
export async function persistClassifierOutput(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: PersistClassifierOutputInput,
): Promise<void> {
  throw new Error(
    "persistClassifierOutput: not implemented — blocked by Epic B (CON-151)",
  );
}

// ---------------------------------------------------------------------------
// Re-exports for downstream consumers (C2/C3/C4).
// ---------------------------------------------------------------------------

export {
  classifierOutputSchema,
  safeDefaultClassifierOutput,
  type ClassifierOutput,
} from "./schema";
export { buildClassifierPrompt, type ClassifierMessage } from "./prompt";

export const CLASSIFIER_CONFIG = {
  model: CLASSIFIER_MODEL,
  maxTokens: CLASSIFIER_MAX_TOKENS,
  temperature: CLASSIFIER_TEMPERATURE,
} as const;
