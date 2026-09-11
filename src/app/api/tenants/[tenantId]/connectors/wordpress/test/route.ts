import { withApiErrorLogging } from "@/lib/errors/wrap";
import {
  handleWordPressConnectorTest,
  WORDPRESS_CONNECTOR_TEST_ROUTE,
} from "../handler";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

async function postImpl(request: Request, { params }: RouteContext) {
  const { tenantId } = await params;
  return handleWordPressConnectorTest(tenantId, request);
}

export const POST = withApiErrorLogging(postImpl, {
  route: WORDPRESS_CONNECTOR_TEST_ROUTE,
});
