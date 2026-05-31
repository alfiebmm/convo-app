/**
 * Lead Capture — AI summary (CON-95 / C-06)
 *
 * Produces a short, admin-facing summary of the visitor's context when a
 * lead is captured. Runs AFTER the SSE stream closes — never in the hot
 * path. All errors are swallowed and logged; a missing summary never
 * breaks chat or the lead capture itself.
 *
 * The summary is intentionally short (≤ 120 tokens). It is never shown
 * back to the visitor and never re-injected into the model's chat
 * context. Pure audit material for the admin Telegram message + future
 * dashboard view.
 */

import OpenAI from "openai";
import { setLeadSummary } from "./capture";
import type { ConversationLead } from "./types";

/**
 * Soft read of CON-94's `metadata.qualifying.persona` shape. Defined inline
 * so CON-95 has zero hard dependency on PR #19 landing first. When CON-94
 * merges, this can be replaced with an import from `../qualifying/types`.
 */
function readQualifyingPersona(
  metadata: Record<string, unknown> | null | undefined
): Record<string, string> | null {
  if (!metadata) return null;
  const q = (metadata as Record<string, unknown>).qualifying;
  if (!q || typeof q !== "object") return null;
  const persona = (q as Record<string, unknown>).persona;
  if (!persona || typeof persona !== "object") return null;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(persona)) {
    if (typeof v === "string") result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : null;
}

interface SummaryInput {
  conversationId: string;
  tenantName: string;
  /** Recent transcript, oldest first. */
  history: { role: "user" | "assistant"; content: string }[];
  /** The freshly captured (or updated) lead. */
  lead: ConversationLead;
  /** Conversation `metadata` blob (for optional qualifying-question enrichment). */
  metadata: Record<string, unknown> | null;
}

function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function buildSummaryPrompt(input: SummaryInput): string {
  const persona = readQualifyingPersona(input.metadata);
  const personaLines = persona
    ? Object.entries(persona)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n")
    : "  (no qualifying answers)";

  const transcript = input.history
    .slice(-5)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  return [
    `You are summarising a website-visitor lead for the ${input.tenantName} sales/admin team.`,
    `Be concise: ONE sentence covering what the visitor wants, plus a second short sentence on context if useful. Max ~50 words.`,
    `Do NOT restate the visitor's contact details — those are captured separately.`,
    `Do NOT speculate about budget or authority.`,
    `Plain prose, Australian English. No greetings, no sign-offs.`,
    ``,
    `Qualifying answers:`,
    personaLines,
    ``,
    `Intent signals detected: ${input.lead.intentSignals.join(", ") || "(none)"}`,
    `Detection sources: ${input.lead.detection.join(", ")}`,
    ``,
    `Recent transcript:`,
    transcript,
  ].join("\n");
}

/**
 * Fire-and-forget summary generation. Safe to await or to discard.
 * Returns the summary string on success, null on any failure.
 */
export async function generateLeadSummary(
  input: SummaryInput
): Promise<string | null> {
  const openai = getOpenAI();
  if (!openai) {
    console.warn("[Leads] OPENAI_API_KEY missing — skipping summary");
    return null;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are a precise, neutral summariser. Output prose only. No bullet points, no quoting.",
        },
        { role: "user", content: buildSummaryPrompt(input) },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!text) return null;
    await setLeadSummary(input.conversationId, text);
    return text;
  } catch (err) {
    console.error("[Leads] summary generation failed (non-fatal):", err);
    return null;
  }
}

/**
 * Trigger the summariser without waiting. Errors are caught internally.
 * Use this from the chat route's `finally` block.
 */
export function fireAndForgetLeadSummary(input: SummaryInput): void {
  generateLeadSummary(input).catch((err) => {
    console.error("[Leads] summary fire-and-forget caught:", err);
  });
}
