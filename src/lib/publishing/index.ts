/**
 * Publishing Orchestrator
 *
 * Routes content to the correct CMS publisher based on tenant settings.
 * Supports WordPress, Shopify, Webflow, and Generic/Custom REST APIs.
 */
import { db } from "../db";
import { content, tenants } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  publishToWordPress,
  type WPConfig,
  type PublishResult,
} from "./wordpress";
import {
  publishToShopify,
  type ShopifyConfig,
} from "./shopify";
import {
  publishToWebflow,
  type WebflowConfig,
} from "./webflow";
import {
  publishToGeneric,
  type GenericConfig,
} from "./generic";

export type { PublishResult } from "./wordpress";

export type CMSType = "wordpress" | "shopify" | "webflow" | "generic";

export interface CMSConfig {
  type: CMSType;
  wordpress?: WPConfig;
  shopify?: ShopifyConfig;
  webflow?: WebflowConfig;
  generic?: GenericConfig;
}

export interface TenantSettings {
  cms?: CMSConfig;
  autoPublish?: boolean;
  autoPublishThreshold?: number;
  [key: string]: unknown;
}

/**
 * Publish a single content item via the tenant's configured CMS.
 * @param contentId  UUID of the content record
 * @param draft      If true, publish as CMS draft
 */
export async function publishContent(
  contentId: string,
  draft = false
): Promise<PublishResult> {
  // 1. Load content record
  const [item] = await db
    .select()
    .from(content)
    .where(eq(content.id, contentId))
    .limit(1);

  if (!item) {
    return { success: false, error: "Content not found" };
  }

  // 2. Load tenant settings
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, item.tenantId))
    .limit(1);

  if (!tenant) {
    return { success: false, error: "Tenant not found" };
  }

  const settings = (tenant.settings ?? {}) as TenantSettings;
  const cmsConfig = settings.cms;

  if (!cmsConfig?.type) {
    // No external CMS — publish to hosted Q&A pages
    const hostedUrl = `/${tenant.slug}/${item.slug}`;
    await db
      .update(content)
      .set({
        status: "published",
        publishedUrl: hostedUrl,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(content.id, contentId));
    return { success: true, url: hostedUrl };
  }

  // 3. Route to correct publisher
  let result: PublishResult;

  switch (cmsConfig.type) {
    case "wordpress": {
      if (!cmsConfig.wordpress) {
        return {
          success: false,
          error: "WordPress credentials not configured",
        };
      }
      result = await publishToWordPress(cmsConfig.wordpress, item, draft);
      break;
    }
    case "shopify": {
      if (!cmsConfig.shopify) {
        return {
          success: false,
          error: "Shopify credentials not configured",
        };
      }
      const shopifyResult = await publishToShopify(cmsConfig.shopify, item, draft);
      result = {
        success: shopifyResult.success,
        postId: shopifyResult.articleId,
        url: shopifyResult.url,
        error: shopifyResult.error,
      };
      break;
    }
    case "webflow": {
      if (!cmsConfig.webflow) {
        return {
          success: false,
          error: "Webflow credentials not configured",
        };
      }
      const webflowResult = await publishToWebflow(cmsConfig.webflow, item);
      result = {
        success: webflowResult.success,
        postId: webflowResult.itemId ? Number(webflowResult.itemId) : undefined,
        url: webflowResult.url,
        error: webflowResult.error,
      };
      break;
    }
    case "generic": {
      if (!cmsConfig.generic) {
        return {
          success: false,
          error: "Generic CMS not configured",
        };
      }
      const genericResult = await publishToGeneric(cmsConfig.generic, item);
      result = {
        success: genericResult.success,
        postId: genericResult.postId ? Number(genericResult.postId) : undefined,
        url: genericResult.url,
        error: genericResult.error,
      };
      break;
    }
    default:
      return {
        success: false,
        error: `Unsupported CMS type: ${cmsConfig.type}`,
      };
  }

  // 4. On success, update content record
  if (result.success) {
    await db
      .update(content)
      .set({
        status: "published",
        publishedUrl: result.url ?? null,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(content.id, contentId));
  }

  return result;
}

/**
 * Check if a tenant has a CMS configured.
 */
export function hasCMSConfigured(settings: TenantSettings): boolean {
  if (!settings.cms?.type) return false;
  const { type, ...configs } = settings.cms;
  return !!(configs as Record<string, unknown>)[type];
}
