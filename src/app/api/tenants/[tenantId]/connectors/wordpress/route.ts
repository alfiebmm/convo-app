import { withApiErrorLogging } from "@/lib/errors/wrap";
import {
  handleWordPressConnectorDelete,
  handleWordPressConnectorGet,
  handleWordPressConnectorPut,
  WORDPRESS_CONNECTOR_ROUTE,
} from "./handler";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ tenantId: string }>;
};

async function getImpl(_request: Request, { params }: RouteContext) {
  const { tenantId } = await params;
  return handleWordPressConnectorGet(tenantId);
}

async function putImpl(request: Request, { params }: RouteContext) {
  const { tenantId } = await params;
  return handleWordPressConnectorPut(tenantId, request);
}

async function deleteImpl(_request: Request, { params }: RouteContext) {
  const { tenantId } = await params;
  return handleWordPressConnectorDelete(tenantId);
}

export const GET = withApiErrorLogging(getImpl, {
  route: WORDPRESS_CONNECTOR_ROUTE,
});
export const PUT = withApiErrorLogging(putImpl, {
  route: WORDPRESS_CONNECTOR_ROUTE,
});
export const DELETE = withApiErrorLogging(deleteImpl, {
  route: WORDPRESS_CONNECTOR_ROUTE,
});
