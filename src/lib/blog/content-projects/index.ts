export const contentProjectLifecycleStates = [
  "candidate_detected",
  "researching",
  "brief_ready",
  "drafting",
  "uniqueness_pass",
  "optimization_pass",
  "review_ready",
  "approved",
  "published_or_exported",
  "skipped",
  "failed",
] as const;

export type ContentProjectLifecycleState =
  (typeof contentProjectLifecycleStates)[number];

export type ContentProjectBlogStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "publishing"
  | "published"
  | "publish_failed"
  | "rejected"
  | "generation_failed"
  | "update_pending";

export type ContentProjectDecisionAction =
  | "create"
  | "update"
  | "skip"
  | "skip-covered"
  | "skip-nosignal"
  | "failure";

export type ContentProjectBlogPost = {
  id: string;
  tenantId: string;
  threadId: string | null;
  title: string;
  slug: string;
  status: ContentProjectBlogStatus;
  metadata?: Record<string, unknown> | null;
  persona?: string | null;
  topic?: string | null;
  createdAt?: Date | string | null;
  publishedAt?: Date | string | null;
  lastModified?: Date | string | null;
};

export type ContentProjectDecisionLog = {
  id: string;
  tenantId: string;
  conversationId: string;
  action: ContentProjectDecisionAction;
  reason: string;
  primaryKeyword?: string | null;
  intent?: string | null;
  targetBlogPostId?: string | null;
  selectedTargetPostId?: string | null;
  generatedBlogPostId?: string | null;
  updateDraftBlogPostId?: string | null;
  failureBlogPostId?: string | null;
  failureReason?: string | null;
  isContentProducing?: boolean | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | string | null;
};

export type ContentProjectEditorialBrief = {
  id: string;
  blogPostId?: string | null;
  conversationId: string;
  tenantId: string;
  selectedPrimaryKeyword?: string | null;
  needsReview?: boolean | null;
  noStrongTarget?: boolean | null;
  requiredModules?: string[] | null;
  internalLinkPlan?: Array<{ url: string; label?: string; reason?: string }> | null;
  missingDataFallbacks?: Array<{ field: string; fallback_strategy: string }> | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type ContentProjectArtifactKind =
  | "decision"
  | "research"
  | "brief"
  | "draft"
  | "quality_gate"
  | "publish_export";

export type ContentProjectReadModel = {
  id: string;
  tenantId: string;
  conversationId: string | null;
  blogPostId: string | null;
  latestDecisionId: string | null;
  lifecycleState: ContentProjectLifecycleState;
  decisionAction: ContentProjectDecisionAction | null;
  blogStatus: ContentProjectBlogStatus | null;
  title: string;
  slug: string | null;
  topic: string | null;
  persona: string | null;
  primaryKeyword: string | null;
  intent: string | null;
  needsReview: boolean;
  noStrongTarget: boolean;
  missingArtifacts: ContentProjectArtifactKind[];
  failureReason: string | null;
  updatedAt: Date | string | null;
};

export type ContentProjectInput = {
  tenantId: string;
  conversationId?: string | null;
  blogPost?: ContentProjectBlogPost | null;
  latestDecision?: ContentProjectDecisionLog | null;
  editorialBrief?: ContentProjectEditorialBrief | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normaliseState(value: unknown): ContentProjectLifecycleState | null {
  if (typeof value !== "string") return null;
  return contentProjectLifecycleStates.includes(
    value as ContentProjectLifecycleState,
  )
    ? (value as ContentProjectLifecycleState)
    : null;
}

function metadataLifecycleState(
  post?: ContentProjectBlogPost | null,
): ContentProjectLifecycleState | null {
  const metadata = post?.metadata;
  if (!isRecord(metadata)) return null;
  const contentProject = metadata.contentProject;
  if (!isRecord(contentProject)) return null;
  return normaliseState(contentProject.lifecycleState ?? contentProject.state);
}

export function deriveContentProjectState({
  blogPost,
  latestDecision,
  editorialBrief,
}: {
  blogPost?: ContentProjectBlogPost | null;
  latestDecision?: ContentProjectDecisionLog | null;
  editorialBrief?: ContentProjectEditorialBrief | null;
}): ContentProjectLifecycleState {
  const explicitState = metadataLifecycleState(blogPost);
  if (explicitState) return explicitState;

  if (blogPost) {
    if (blogPost.status === "generation_failed" || blogPost.status === "publish_failed") {
      return "failed";
    }
    if (blogPost.status === "published" || blogPost.status === "publishing") {
      return "published_or_exported";
    }
    if (blogPost.status === "approved") return "approved";
    if (
      blogPost.status === "draft" ||
      blogPost.status === "in_review" ||
      blogPost.status === "update_pending"
    ) {
      return "review_ready";
    }
    if (blogPost.status === "rejected") return "skipped";
  }

  if (latestDecision?.action === "failure") return "failed";
  if (
    latestDecision?.action === "skip" ||
    latestDecision?.action === "skip-covered" ||
    latestDecision?.action === "skip-nosignal"
  ) {
    return "skipped";
  }

  if (editorialBrief) return "brief_ready";
  if (latestDecision?.action === "create" || latestDecision?.action === "update") {
    return "researching";
  }

  return "candidate_detected";
}

function hasResearchArtifact(decision?: ContentProjectDecisionLog | null) {
  if (!decision?.metadata || !isRecord(decision.metadata)) return false;
  const research = decision.metadata.research ?? decision.metadata.seoResearch;
  return Boolean(research);
}

function hasQualityGateArtifact(post?: ContentProjectBlogPost | null) {
  if (!post?.metadata || !isRecord(post.metadata)) return false;
  return Boolean(
    post.metadata.qualityGate ||
      post.metadata.qualityGates ||
      post.metadata.validation ||
      post.metadata.readiness,
  );
}

export function missingContentProjectArtifacts({
  blogPost,
  latestDecision,
  editorialBrief,
}: {
  blogPost?: ContentProjectBlogPost | null;
  latestDecision?: ContentProjectDecisionLog | null;
  editorialBrief?: ContentProjectEditorialBrief | null;
}): ContentProjectArtifactKind[] {
  const missing = new Set<ContentProjectArtifactKind>();
  if (!latestDecision) missing.add("decision");
  if (!hasResearchArtifact(latestDecision)) missing.add("research");
  if (!editorialBrief) missing.add("brief");
  if (!blogPost) missing.add("draft");
  if (blogPost && !hasQualityGateArtifact(blogPost)) missing.add("quality_gate");
  if (
    blogPost &&
    blogPost.status !== "published" &&
    blogPost.status !== "publishing" &&
    !blogPost.publishedAt
  ) {
    missing.add("publish_export");
  }
  return Array.from(missing);
}

function fallbackTitle(input: ContentProjectInput) {
  const keyword =
    input.editorialBrief?.selectedPrimaryKeyword ??
    input.latestDecision?.primaryKeyword ??
    input.latestDecision?.intent;
  if (keyword) return `Content project: ${keyword}`;
  if (input.conversationId) return "Conversation content project";
  return "Content project";
}

function failureReason(input: ContentProjectInput) {
  if (input.latestDecision?.failureReason) return input.latestDecision.failureReason;
  if (input.blogPost?.status === "generation_failed") return "Generation failed.";
  if (input.blogPost?.status === "publish_failed") return "Publishing failed.";
  if (input.latestDecision?.action === "failure") return input.latestDecision.reason;
  return null;
}

export function toContentProjectReadModel(
  input: ContentProjectInput,
): ContentProjectReadModel {
  const lifecycleState = deriveContentProjectState(input);
  const conversationId =
    input.conversationId ??
    input.blogPost?.threadId ??
    input.latestDecision?.conversationId ??
    input.editorialBrief?.conversationId ??
    null;
  const blogPostId = input.blogPost?.id ?? input.editorialBrief?.blogPostId ?? null;
  const primaryKeyword =
    input.editorialBrief?.selectedPrimaryKeyword ??
    input.latestDecision?.primaryKeyword ??
    null;

  return {
    id: blogPostId ?? input.latestDecision?.id ?? conversationId ?? input.tenantId,
    tenantId: input.tenantId,
    conversationId,
    blogPostId,
    latestDecisionId: input.latestDecision?.id ?? null,
    lifecycleState,
    decisionAction: input.latestDecision?.action ?? null,
    blogStatus: input.blogPost?.status ?? null,
    title: input.blogPost?.title ?? fallbackTitle(input),
    slug: input.blogPost?.slug ?? null,
    topic: input.blogPost?.topic ?? input.latestDecision?.primaryKeyword ?? null,
    persona: input.blogPost?.persona ?? null,
    primaryKeyword,
    intent: input.latestDecision?.intent ?? null,
    needsReview: Boolean(
      input.editorialBrief?.needsReview ||
        input.editorialBrief?.noStrongTarget ||
        lifecycleState === "failed",
    ),
    noStrongTarget: Boolean(input.editorialBrief?.noStrongTarget),
    missingArtifacts: missingContentProjectArtifacts(input),
    failureReason: failureReason(input),
    updatedAt:
      input.blogPost?.lastModified ??
      input.editorialBrief?.updatedAt ??
      input.latestDecision?.createdAt ??
      null,
  };
}

