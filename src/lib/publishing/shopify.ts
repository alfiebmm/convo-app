/**
 * Shopify Publishing Service
 *
 * Publishes content to Shopify blogs via the Admin REST API.
 */
import { marked } from "marked";

export interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  blogId: string;
}

export interface ShopifyPublishResult {
  success: boolean;
  articleId?: number;
  url?: string;
  error?: string;
}

interface ContentRecord {
  title: string | null;
  slug: string | null;
  metaDescription: string | null;
  body: string | null;
}

/**
 * Publish an article to Shopify blog via Admin REST API.
 */
export async function publishToShopify(
  config: ShopifyConfig,
  article: ContentRecord,
  draft = false
): Promise<ShopifyPublishResult> {
  try {
    const htmlContent = article.body ? await marked.parse(article.body) : "";
    const summaryHtml = article.metaDescription
      ? `<p>${article.metaDescription}</p>`
      : undefined;

    const domain = config.shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const endpoint = `https://${domain}/admin/api/2024-01/blogs/${config.blogId}/articles.json`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": config.accessToken,
      },
      body: JSON.stringify({
        article: {
          title: article.title ?? "Untitled",
          body_html: htmlContent,
          summary_html: summaryHtml,
          handle: article.slug ?? undefined,
          published: !draft,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: `Shopify API error (${response.status}): ${errorBody}`,
      };
    }

    const data = await response.json();
    const articleData = data.article;

    // Build the public article URL
    const articleUrl = `https://${domain}/blogs/${config.blogId}/${articleData.handle || articleData.id}`;

    return {
      success: true,
      articleId: articleData.id,
      url: articleUrl,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Shopify publish error",
    };
  }
}

/**
 * Test Shopify connection by listing blogs.
 * Returns the list of available blogs on success.
 */
export async function testShopifyConnection(
  config: Pick<ShopifyConfig, "shopDomain" | "accessToken">
): Promise<{
  success: boolean;
  blogs?: Array<{ id: number; title: string }>;
  error?: string;
}> {
  try {
    const domain = config.shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const endpoint = `https://${domain}/admin/api/2024-01/blogs.json`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": config.accessToken,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Connection failed (${response.status}): ${response.statusText}`,
      };
    }

    const data = await response.json();
    const blogs = (data.blogs ?? []).map((b: { id: number; title: string }) => ({
      id: b.id,
      title: b.title,
    }));

    return { success: true, blogs };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
