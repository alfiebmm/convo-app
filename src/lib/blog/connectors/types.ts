import type { BlogPostDetail } from "@/lib/blog/queries";

export type ConnectorResult<T> = { ok: true } & T;

export type ConnectorFailure = { ok: false; error: string };

export type PublishArticleResult =
  | ConnectorResult<{ wpPostId: number; wpPostUrl: string }>
  | ConnectorFailure;

export type VerifyCredentialsResult =
  | ConnectorResult<{ siteUrl: string }>
  | ConnectorFailure;

export type PublishArticle = (
  config: unknown,
  post: BlogPostDetail,
) => Promise<PublishArticleResult>;
