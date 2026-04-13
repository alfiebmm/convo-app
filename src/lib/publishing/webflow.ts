/**
 * Webflow Publishing Service
 *
 * Publishes content to Webflow CMS via the v2 API.
 * Items are created as drafts — Webflow requires a separate publish step.
 */
import { marked } from "marked";

export interface WebflowConfig {
  siteId: string;
  collectionId: string;
  accessToken: string;
  /** Optional custom field mapping. Defaults are sensible for a blog collection. */
  fieldMapping?: {
    name?: string;        // default: "name"
    slug?: string;        // default: "slug"
    body?: string;        // default: "post-body"
    summary?: string;     // default: "post-summary"
  };
}

export interface WebflowPublishResult {
  success: boolean;
  itemId?: string;
  url?: string;
  error?: string;
}

interface ContentRecord {
  title: string | null;
  slug: string | null;
  metaDescription: string | null;
  body: string | null;
}

const DEFAULT_FIELD_MAP = {
  name: "name",
  slug: "slug",
  body: "post-body",
  summary: "post-summary",
};

/**
 * Publish content as a Webflow CMS item (draft).
 */
export async function publishToWebflow(
  config: WebflowConfig,
  article: ContentRecord
): Promise<WebflowPublishResult> {
  try {
    const htmlContent = article.body ? await marked.parse(article.body) : "";
    const fm = { ...DEFAULT_FIELD_MAP, ...config.fieldMapping };

    const endpoint = `https://api.webflow.com/v2/collections/${config.collectionId}/items`;

    const fieldData: Record<string, unknown> = {
      [fm.name]: article.title ?? "Untitled",
      [fm.slug]: article.slug ?? undefined,
      [fm.body]: htmlContent,
      [fm.summary]: article.metaDescription ?? undefined,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify({
        isArchived: false,
        isDraft: true,
        fieldData,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: `Webflow API error (${response.status}): ${errorBody}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      itemId: data.id,
      // Webflow doesn't return a public URL directly — item is draft
      url: undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Webflow publish error",
    };
  }
}

/**
 * Test Webflow connection by fetching collections for the site.
 */
export async function testWebflowConnection(
  config: Pick<WebflowConfig, "siteId" | "accessToken">
): Promise<{
  success: boolean;
  collections?: Array<{ id: string; displayName: string; slug: string }>;
  error?: string;
}> {
  try {
    const endpoint = `https://api.webflow.com/v2/sites/${config.siteId}/collections`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Connection failed (${response.status}): ${response.statusText}`,
      };
    }

    const data = await response.json();
    const collections = (data.collections ?? []).map(
      (c: { id: string; displayName: string; slug: string }) => ({
        id: c.id,
        displayName: c.displayName,
        slug: c.slug,
      })
    );

    return { success: true, collections };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
