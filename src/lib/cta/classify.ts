/**
 * CTA Thread Tag Classifier (CON-93 / C-04)
 *
 * Lightweight, deterministic keyword classifier that picks a "primary tag"
 * for a conversation thread. Used by the CTA resolver to match against
 * `forumConfig.cta_rules[].tag`.
 *
 * Why keyword (not LLM):
 *   - Zero extra OpenAI latency / cost on every reply.
 *   - Deterministic and unit-testable.
 *   - Tag space is small per-tenant (cta_rules tags + allowed_topics).
 *   - If accuracy proves weak in production we can escalate to a structured
 *     tag head on the same OpenAI call later — out of scope for CON-93.
 */

/**
 * A single message in the thread relevant to classification.
 * Only user messages drive tag selection; assistant messages are ignored
 * because the assistant's word choice would dominate the signal.
 */
export interface ClassifiableMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClassifyOptions {
  /**
   * How many of the most recent user messages to weigh.
   * Older context is rarely indicative of the current intent.
   * Default 5.
   */
  recentUserMessages?: number;
  /**
   * Recency boost applied to the most recent user message.
   * The latest message tends to express the immediate intent.
   * Default 2.
   */
  recencyBoost?: number;
}

/**
 * Normalise a string for whole-word keyword matching.
 * Lowercases, strips punctuation, collapses whitespace, pads with single
 * spaces so we can `.includes(" word ")` for whole-word checks cheaply.
 */
function normalise(input: string): string {
  return (
    " " +
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() +
    " "
  );
}

/**
 * Generate match tokens for a tag — the tag itself plus naive variants:
 * - tag as-is, lowercased
 * - hyphen / underscore / dot variants normalised to spaces
 * - singularised plural (drop trailing 's' if length > 3)
 * Duplicates are removed.
 */
function tagTokens(tag: string): string[] {
  const base = tag.toLowerCase().trim();
  if (!base) return [];
  const flattened = base.replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();
  const candidates = new Set<string>();
  candidates.add(flattened);
  // Singular variant if it's a simple plural.
  if (flattened.length > 3 && flattened.endsWith("s") && !flattened.endsWith("ss")) {
    candidates.add(flattened.slice(0, -1));
  }
  return [...candidates];
}

/**
 * Pick the primary tag for a conversation from a candidate tag list.
 *
 * Scoring:
 *   - Each candidate tag earns 1 point per whole-word/phrase occurrence in
 *     a normalised user message.
 *   - The most recent user message's score is multiplied by `recencyBoost`
 *     (default 2) so the latest intent wins close ties.
 *   - Tiebreak: tag order in the input list (the order tenants specified
 *     them in their config — they get to control precedence).
 *
 * @returns the highest-scoring tag, or `null` if nothing matches.
 */
export function classifyPrimaryTag(
  messages: ClassifiableMessage[],
  candidateTags: string[],
  options: ClassifyOptions = {}
): string | null {
  if (!candidateTags.length) return null;
  if (!messages.length) return null;

  const recent = options.recentUserMessages ?? 5;
  const boost = options.recencyBoost ?? 2;

  // Most-recent-first list of user messages, capped at `recent`.
  const userMessages = messages.filter((m) => m.role === "user").slice(-recent);
  if (!userMessages.length) return null;

  // Pre-normalise the body of each user message once.
  const normalised = userMessages.map((m) => normalise(m.content));

  // Score every candidate tag.
  const scores: { tag: string; score: number; orderIndex: number }[] = [];

  candidateTags.forEach((tag, orderIndex) => {
    const tokens = tagTokens(tag);
    if (!tokens.length) return;

    let score = 0;
    normalised.forEach((body, i) => {
      const isLatest = i === normalised.length - 1;
      const weight = isLatest ? boost : 1;
      for (const token of tokens) {
        const needle = " " + token + " ";
        // Count whole-word occurrences.
        let idx = body.indexOf(needle);
        while (idx !== -1) {
          score += weight;
          idx = body.indexOf(needle, idx + needle.length);
        }
      }
    });

    if (score > 0) {
      scores.push({ tag, score, orderIndex });
    }
  });

  if (!scores.length) return null;

  // Highest score wins. Tiebreak by tenant-specified order (lower index first).
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.orderIndex - b.orderIndex;
  });

  return scores[0].tag;
}
