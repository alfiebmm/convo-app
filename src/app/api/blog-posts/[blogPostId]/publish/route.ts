import { withApiErrorLogging } from "@/lib/errors/wrap";

import {
  BLOG_POST_PUBLISH_ROUTE,
  handleBlogPostPublishPost,
} from "./handler";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ blogPostId: string }>;
};

async function postImpl(_request: Request, { params }: RouteContext) {
  const { blogPostId } = await params;
  return handleBlogPostPublishPost(blogPostId);
}

export const POST = withApiErrorLogging(postImpl, {
  route: BLOG_POST_PUBLISH_ROUTE,
});
