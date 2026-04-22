/**
 * Guardrails System
 *
 * Builds dynamic system prompts based on tenant guardrails config
 * and conversation context (page URL, turn count, etc.).
 */

// ─── Types ───────────────────────────────────────────────────

export interface AudienceConfig {
  id: string;
  name: string;
  urlPatterns: string[];
  persona: string;
  ctaMessages: string[];
  ctaAfterTurns: number;
}

export interface DeflectRule {
  topic: string;
  response: string;
}

export interface TopicBoundaries {
  allow: string[];
  deflect: DeflectRule[];
  hardBlock: string[];
}

export interface ConversationLimits {
  maxTurnsBeforeCTA: number;
  idleTimeoutMinutes: number;
}

export interface GuardrailsConfig {
  audiences: AudienceConfig[];
  topicBoundaries: TopicBoundaries;
  conversationLimits: ConversationLimits;
}

export interface NotificationsConfig {
  enabled: boolean;
  telegram?: {
    botToken: string;
    chatId: string;
  };
  mode: "all" | "digest" | "off";
}

export interface ConversationMetadata {
  pageUrl?: string;
  referrer?: string;
  visitorId?: string;
  turnCount?: number;
}

// ─── Audience Detection ──────────────────────────────────────

/**
 * Match a page URL against audience URL patterns.
 * Patterns support trailing wildcards: "/breeders*" matches "/breeders/foo"
 * A single "*" matches everything.
 */
export function detectAudience(
  audiences: AudienceConfig[],
  pageUrl?: string
): AudienceConfig {
  if (!pageUrl || audiences.length === 0) {
    return audiences[0] ?? fallbackAudience();
  }

  // Parse the URL to get the pathname
  let pathname: string;
  try {
    const url = new URL(pageUrl);
    pathname = url.pathname;
  } catch {
    // If it's already a path or malformed, use as-is
    pathname = pageUrl;
  }

  // Check specific patterns first (skip catch-all "*" patterns)
  for (const audience of audiences) {
    for (const pattern of audience.urlPatterns) {
      if (pattern === "*") continue; // skip catch-all on first pass
      if (matchPattern(pattern, pathname)) {
        return audience;
      }
    }
  }

  // Fall back to catch-all pattern or first audience
  for (const audience of audiences) {
    if (audience.urlPatterns.includes("*")) {
      return audience;
    }
  }

  return audiences[0] ?? fallbackAudience();
}

function matchPattern(pattern: string, pathname: string): boolean {
  if (pattern === "*") return true;

  // Handle trailing wildcard: "/breeders*" → matches anything starting with "/breeders"
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return pathname.startsWith(prefix);
  }

  // Exact match
  return pathname === pattern;
}

function fallbackAudience(): AudienceConfig {
  return {
    id: "default",
    name: "Visitor",
    urlPatterns: ["*"],
    persona: "You are a friendly, knowledgeable assistant. Be concise but thorough.",
    ctaMessages: [],
    ctaAfterTurns: 5,
  };
}

// ─── System Prompt Builder ───────────────────────────────────

export interface TenantForGuardrails {
  name: string;
  domain?: string | null;
  settings: Record<string, unknown> | null;
}

/**
 * Behavioural rules that apply to every reply, regardless of tenant config.
 * Prepended to the system prompt so the model treats them as hard constraints.
 */
const GLOBAL_RULES = `# HARD RULES — Behaviour

## Response length
Use discretion. Match the length to the question:
- Simple factual questions ("what's x?") → 1 short sentence
- Social / conversational ("hi", "thanks") → 1 sentence
- Informational with context → 1–2 short paragraphs
- NEVER exceed 2 short paragraphs in one reply
- NEVER use bullet lists longer than 3 items
Don't pad. Don't repeat the question back. Don't add filler like "Great question!"

## Clarify before answering
If the user's first message is vague, ambiguous, or could be answered differently depending on who they are or what they need, ask ONE clarifying question before answering. Do NOT guess. Guessing wastes their time.

If you asked a qualifying question (e.g. "are you a farmer or contractor?") and their reply does NOT clearly answer it, politely re-ask. Do not proceed with a generic response that assumes an answer.

Once you know the user's context, use it. Every subsequent reply should reflect what they told you — don't keep re-asking or ignore their stated context.

`;

/**
 * Collect allowed topics from both the structured Settings location and
 * the legacy flat Widget location, deduped. Structured takes precedence
 * on collisions but we merge so neither source silently disappears.
 */
function collectAllowedTopics(
  settings: Record<string, unknown>
): string[] {
  const out = new Set<string>();
  const guardrails = settings.guardrails as GuardrailsConfig | undefined;
  const structured = guardrails?.topicBoundaries?.allow;
  if (Array.isArray(structured)) {
    structured
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean)
      .forEach((t) => out.add(t));
  }
  const widget = settings.widget as Record<string, unknown> | undefined;
  const legacy = widget?.allowedTopics;
  if (typeof legacy === "string" && legacy.trim()) {
    legacy
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((t) => out.add(t));
  }
  return Array.from(out);
}

/**
 * Build a complete system prompt from tenant guardrails config
 * and conversation context.
 */
export function buildSystemPrompt(
  tenant: TenantForGuardrails,
  metadata: ConversationMetadata
): string {
  const settings = tenant.settings ?? {};
  const guardrails = settings.guardrails as GuardrailsConfig | undefined;

  // No guardrails configured — use widget config, legacy persona, or default
  if (!guardrails || !guardrails.audiences?.length) {
    const widget = settings.widget as Record<string, unknown> | undefined;
    let prompt =
      (widget?.systemPrompt as string) ??
      (settings.persona as string) ??
      (settings.systemPrompt as string) ??
      `You are a friendly, knowledgeable assistant embedded on ${tenant.name}'s website. Be concise but thorough. If you don't know something, say so honestly.`;

    // Append context
    prompt += `\n\nYou are the AI assistant for ${tenant.name}${tenant.domain ? ` (${tenant.domain})` : ""}.`;

    // Allowed topics — single source of truth is now
    // settings.guardrails.topicBoundaries.allow (array). We also honour the
    // legacy flat settings.widget.allowedTopics (comma-separated string) so
    // tenants created before the Widget-tab field was removed don't lose
    // their topic restrictions.
    const allowedTopics = collectAllowedTopics(settings);
    if (allowedTopics.length) {
      prompt += `\n\nYou should only discuss topics related to: ${allowedTopics.join(", ")}. Politely decline to discuss other topics.`;
    }

    // CON-42: response length, graduated not fixed. CON-41: clarify before
    // answering vague questions.
    prompt = GLOBAL_RULES + prompt;

    return prompt;
  }

  const audience = detectAudience(guardrails.audiences, metadata.pageUrl);
  const turnCount = metadata.turnCount ?? 0;
  const boundaries = guardrails.topicBoundaries;
  const limits = guardrails.conversationLimits;

  const sections: string[] = [];

  // 1. Base persona
  sections.push(`# Your Role\n${audience.persona}`);

  // 2. Context
  sections.push(
    `# Context\nYou are the AI assistant for ${tenant.name}${tenant.domain ? ` (${tenant.domain})` : ""}.`
  );

  // 3. Audience awareness & self-correction
  const otherAudiences = guardrails.audiences
    .filter((a) => a.id !== audience.id)
    .map((a) => a.name)
    .join(", ");

  if (otherAudiences) {
    sections.push(
      `# Audience Awareness\nYou've identified this visitor as a "${audience.name}" based on the page they're viewing. ` +
      `Other audience types include: ${otherAudiences}. ` +
      `If the user reveals they're actually a different audience type, seamlessly adjust your approach without acknowledging the switch.`
    );
  }

  // 4. Topic boundaries
  if (boundaries) {
    const boundaryParts: string[] = ["# Topic Boundaries"];

    if (boundaries.allow?.length) {
      boundaryParts.push(
        `**Allowed topics:** ${boundaries.allow.join(", ")}`
      );
    }

    if (boundaries.deflect?.length) {
      boundaryParts.push("**Deflect these topics with the given response:**");
      for (const rule of boundaries.deflect) {
        boundaryParts.push(`- "${rule.topic}" → "${rule.response}"`);
      }
    }

    if (boundaries.hardBlock?.length) {
      boundaryParts.push(
        `**Hard block — NEVER engage with:** ${boundaries.hardBlock.join(", ")}. ` +
        `If a user brings up any of these topics, politely decline and redirect the conversation.`
      );
    }

    sections.push(boundaryParts.join("\n"));
  }

  // 5. CTA rules
  const ctaThreshold = audience.ctaAfterTurns ?? limits?.maxTurnsBeforeCTA ?? 5;
  if (audience.ctaMessages?.length) {
    if (turnCount >= ctaThreshold) {
      sections.push(
        `# Call to Action\nThe conversation has reached ${turnCount} exchanges. ` +
        `Naturally weave one of these CTAs into your next response when appropriate:\n` +
        audience.ctaMessages.map((cta) => `- ${cta}`).join("\n") +
        `\nDo NOT force the CTA — integrate it naturally based on what the user is asking about.`
      );
    } else {
      sections.push(
        `# Call to Action\nAfter approximately ${ctaThreshold} exchanges, begin naturally incorporating these CTAs:\n` +
        audience.ctaMessages.map((cta) => `- ${cta}`).join("\n") +
        `\nDo NOT insert CTAs yet — focus on being helpful first.`
      );
    }
  }

  // CON-42: response length, graduated not fixed. CON-41: clarify before
  // answering vague questions.
  return GLOBAL_RULES + sections.join("\n\n");
}
