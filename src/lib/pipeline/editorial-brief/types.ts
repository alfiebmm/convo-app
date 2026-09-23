export type KeywordPriority = "high" | "medium" | "low";
export type SearchIntent =
  | "informational"
  | "commercial"
  | "transactional"
  | "navigational";

export type TenantSeoStrategy = {
  id?: string;
  tenantId: string;
  targetKeywords: Array<{
    keyword: string;
    priority: KeywordPriority;
    notes?: string;
  }>;
  priorityServices: Array<{ name: string; url?: string; notes?: string }>;
  priorityLocations: Array<{ name: string; notes?: string }>;
  targetAudiences: Array<{ persona: string; description?: string }>;
  approvedInternalUrls: Array<{ url: string; label?: string; topic?: string }>;
  preferredCtas: Array<{
    label: string;
    url?: string;
    article_type?: string;
    audience?: string;
  }>;
  avoidTopics: string[];
  avoidClaims: string[];
  avoidKeywords: string[];
  revision?: number;
};

export type EditorialBrief = {
  id?: string;
  blogPostId?: string | null;
  conversationId: string;
  tenantId: string;
  selectedPrimaryKeyword: string | null;
  selectionRationale: string;
  supportingKeywords: string[];
  supportingEntities: string[];
  conversationEvidence: Array<{
    messageId?: string;
    role?: string;
    snippet: string;
  }>;
  tenantFactsUsed: {
    services: Array<{ name: string; url?: string; notes?: string }>;
    locations: Array<{ name: string; notes?: string }>;
    audiences: Array<{ persona: string; description?: string }>;
  };
  missingDataFallbacks: Array<{ field: string; fallback_strategy: string }>;
  requiredModules: string[];
  internalLinkPlan: Array<{ url: string; label?: string; reason?: string }>;
  ctaPlan: { label?: string; url?: string; rationale?: string };
  createUpdateSkip: "create" | "update" | "skip";
  createUpdateSkipRationale: string;
  noStrongTarget: boolean;
  needsReview: boolean;
  searchIntent: SearchIntent;
  targetAudience: string | null;
  articleType: string;
};

export type EditorialBriefMessage = {
  id?: string;
  role: string;
  content: string;
};

export type EditorialBriefDecision = {
  action: "create" | "update" | "skip" | "skip-covered" | "skip-nosignal" | "failure";
  primaryKeyword?: string | null;
  intent?: string | null;
  reason?: string | null;
  targetBlogPostId?: string | null;
};

export type ArticleSeoFields = {
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  searchIntent: SearchIntent | null;
  targetAudience: string | null;
  articleType: string | null;
  internalLinkSuggestions: Array<{ url: string; label?: string }>;
  ctaGoal: string | null;
};
