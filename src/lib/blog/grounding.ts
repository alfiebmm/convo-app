import type { EditorialBrief } from "@/lib/pipeline/editorial-brief";

import type { BlogPostJson, WritingRuleViolation } from "./writing-rules";

export type GroundingDecision = "supported" | "unsupported" | "uncertain";

export type GroundingSourceKind =
  | "tenant_settings"
  | "brand"
  | "source_conversation"
  | "editorial_brief"
  | "previous_version"
  | "approved_reference";

export type GroundingEvidenceSource = {
  kind: GroundingSourceKind;
  label: string;
  text: string;
};

export type GroundingClaim = {
  claim: string;
  category: string;
  decision: GroundingDecision;
  sentence: string;
  sources: GroundingEvidenceSource[];
  reason: string;
};

export type GroundingReport = {
  ok: boolean;
  needsReview: boolean;
  summary: string;
  claims: GroundingClaim[];
};

export type TenantEvidenceInput = {
  tenant: {
    name: string;
    settings?: unknown;
    brandJson?: unknown;
  };
  sourceMessages?: Array<{ role?: string; content: string | null }>;
  editorial?: EditorialBrief;
  previousPost?: unknown;
  approvedReferences?: GroundingEvidenceSource[];
};

type ClaimPattern = {
  category: string;
  label: string;
  pattern: RegExp;
  supportTerms: string[];
};

const PRODUCT_CLAIM_PATTERNS: ClaimPattern[] = [
  {
    category: "reviews_ratings",
    label: "reviews or ratings",
    pattern: /\b(?:verified\s+|customer\s+|user\s+|public\s+)(?:reviews?|ratings?)\b|\bratings?\b|\bstar(?:red)?\s+ratings?\b/i,
    supportTerms: ["customer review", "customer reviews", "verified reviews", "rating", "ratings", "star rating"],
  },
  {
    category: "forums_discussions",
    label: "forums or discussions",
    pattern: /\bforums?\b|\bdiscussion(?:s| boards?| threads?)\b|\bcommunity\s+(?:board|forum|discussion)s?\b/i,
    supportTerms: ["forum", "forums", "discussion", "discussion board", "community board"],
  },
  {
    category: "webinars_training",
    label: "webinars or training",
    pattern: /\bwebinars?\b|\btraining\s+(?:courses?|sessions?|programmes?|programs?)\b|\bworkshops?\b/i,
    supportTerms: ["webinar", "webinars", "training", "training courses", "workshop", "workshops"],
  },
  {
    category: "payments_contracts",
    label: "secure payments or contracts",
    pattern: /\bsecure\s+payments?\b|\bpayments?\s+(?:portal|protection|processing)\b|\bescrow\b|\bcontract\s+(?:templates?|management|tools?|workflow)\b|\bdigital\s+contracts?\b/i,
    supportTerms: [
      "secure payment",
      "secure payments",
      "payment portal",
      "payment protection",
      "escrow",
      "contract management",
      "digital contract",
      "digital contracts",
    ],
  },
  {
    category: "booking_scheduling",
    label: "booking or scheduling platform",
    pattern: /\bonline\s+bookings?\b|\bbooking\s+(?:portal|platform|system)\b|\bscheduling\s+(?:portal|platform|system|tools?)\b/i,
    supportTerms: ["online booking", "online bookings", "booking portal", "booking system", "scheduling"],
  },
  {
    category: "rewards_loyalty",
    label: "rewards or loyalty programme",
    pattern: /\bloyalty\s+(?:programme|program|points?|rewards?)\b|\brewards?\s+(?:programme|program|points?)\b/i,
    supportTerms: ["loyalty programme", "loyalty program", "loyalty points", "rewards programme", "rewards program"],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function flattenStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(flattenStrings);
  return Object.values(value as Record<string, unknown>).flatMap(flattenStrings);
}

function normaliseText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function sentenceContaining(text: string, matchIndex: number): string {
  const start = Math.max(
    text.lastIndexOf(".", matchIndex),
    text.lastIndexOf("!", matchIndex),
    text.lastIndexOf("?", matchIndex),
    text.lastIndexOf("\n", matchIndex)
  );
  const endCandidates = [".", "!", "?", "\n"]
    .map((delimiter) => text.indexOf(delimiter, matchIndex))
    .filter((index) => index >= 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : text.length;
  return text.slice(start + 1, end + 1).replace(/\s+/g, " ").trim();
}

function allPostText(post: BlogPostJson): string {
  return [
    post.title,
    post.dek,
    post.intro,
    ...post.sections.flatMap((section) => [
      section.heading,
      ...section.blocks.flatMap(flattenStrings),
    ]),
    ...post.faqs.flatMap((faq) => [faq.q, faq.a]),
    ...(post.seo?.keywords ?? []),
    post.seo?.metaTitle,
    post.seo?.metaDescription,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join("\n");
}

function evidenceSources(input: TenantEvidenceInput): GroundingEvidenceSource[] {
  const sources: GroundingEvidenceSource[] = [];
  const settings = input.tenant.settings;
  const brand = input.tenant.brandJson;

  if (settings) {
    sources.push({
      kind: "tenant_settings",
      label: "Tenant settings",
      text: flattenStrings(settings).join("\n"),
    });
  }
  if (brand) {
    sources.push({
      kind: "brand",
      label: "Brand/site config",
      text: flattenStrings(brand).join("\n"),
    });
  }
  for (const [index, message] of (input.sourceMessages ?? []).entries()) {
    if (!message.content) continue;
    sources.push({
      kind: "source_conversation",
      label: `Source conversation ${index + 1}${message.role ? ` (${message.role})` : ""}`,
      text: message.content,
    });
  }
  if (input.editorial) {
    sources.push({
      kind: "editorial_brief",
      label: "Editorial brief",
      text: flattenStrings({
        selectedPrimaryKeyword: input.editorial.selectedPrimaryKeyword,
        supportingKeywords: input.editorial.supportingKeywords,
        supportingEntities: input.editorial.supportingEntities,
        conversationEvidence: input.editorial.conversationEvidence,
        tenantFactsUsed: input.editorial.tenantFactsUsed,
        internalLinkPlan: input.editorial.internalLinkPlan,
        ctaPlan: input.editorial.ctaPlan,
      }).join("\n"),
    });
  }
  if (input.previousPost) {
    sources.push({
      kind: "previous_version",
      label: "Previous article version",
      text: flattenStrings(input.previousPost).join("\n"),
    });
  }
  sources.push(...(input.approvedReferences ?? []));

  return sources.filter((source) => source.text.trim().length > 0);
}

function supportedByEvidence(pattern: ClaimPattern, sources: GroundingEvidenceSource[]) {
  const matched = sources.filter((source) => {
    const text = normaliseText(source.text);
    return pattern.supportTerms.some((term) => text.includes(normaliseText(term)));
  });
  return matched;
}

export function validateGrounding(
  post: BlogPostJson,
  input: TenantEvidenceInput,
): GroundingReport {
  const text = allPostText(post);
  const sources = evidenceSources(input);
  const claims: GroundingClaim[] = [];

  for (const pattern of PRODUCT_CLAIM_PATTERNS) {
    const regex = new RegExp(pattern.pattern.source, `${pattern.pattern.flags.replace("g", "")}g`);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      const evidence = supportedByEvidence(pattern, sources);
      const sentence = sentenceContaining(text, match.index);
      claims.push({
        claim: match[0],
        category: pattern.category,
        decision: evidence.length > 0 ? "supported" : "unsupported",
        sentence,
        sources: evidence,
        reason:
          evidence.length > 0
            ? `Supported by ${evidence.map((source) => source.label).join(", ")}.`
            : `The draft mentions ${pattern.label}, but no tenant evidence source supports that feature or policy.`,
      });
    }
  }

  const unsupported = claims.filter((claim) => claim.decision === "unsupported");
  const uncertain = sources.length === 0
    ? [{
        claim: "tenant evidence",
        category: "evidence",
        decision: "uncertain" as const,
        sentence: "",
        sources: [],
        reason: "No tenant evidence was available for grounding validation.",
      }]
    : [];
  const allClaims = [...claims, ...uncertain];

  return {
    ok: unsupported.length === 0 && uncertain.length === 0,
    needsReview: unsupported.length > 0 || uncertain.length > 0,
    summary:
      unsupported.length > 0
        ? `${unsupported.length} unsupported product claim${unsupported.length === 1 ? "" : "s"} found.`
        : uncertain.length > 0
          ? "Grounding is uncertain because tenant evidence is unavailable."
          : "Grounding checks passed.",
    claims: allClaims,
  };
}

export function groundingViolation(report: GroundingReport): WritingRuleViolation | null {
  const unsupported = report.claims.filter((claim) => claim.decision === "unsupported");
  if (unsupported.length === 0) return null;
  const first = unsupported[0];
  return {
    code: "grounding",
    message: `Unsupported tenant product claim: ${first.reason}`,
    sentence: first.sentence,
  };
}

export function groundingReportFromMetadata(metadata: unknown): GroundingReport | null {
  if (!isRecord(metadata)) return null;
  const direct = metadata.grounding;
  if (isRecord(direct) && Array.isArray(direct.claims)) return direct as GroundingReport;
  const generation = metadata.generation;
  if (!isRecord(generation)) return null;
  const nested = generation.grounding;
  return isRecord(nested) && Array.isArray(nested.claims) ? (nested as GroundingReport) : null;
}
