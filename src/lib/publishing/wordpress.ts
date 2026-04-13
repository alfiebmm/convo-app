/**
 * WordPress Publishing Service
 *
 * Publishes content to WordPress via the REST API.
 */
import { marked } from "marked";

export interface WPConfig {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface PublishResult {
  success: boolean;
  postId?: number;
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
 * Publish an article to WordPress via REST API.
 * @param config  WordPress connection credentials
 * @param article Content record to publish
 * @param draft   If true, publish as WP draft instead of live
 */
export async function publishToWordPress(
  config: WPConfig,
  article: ContentRecord,
  draft = false
): Promise<PublishResult> {
  try {
    // Convert markdown body to HTML
    const htmlContent = article.body ? await marked.parse(article.body) : "";

    const siteUrl = config.siteUrl.replace(/\/+$/, "");
    const endpoint = `${siteUrl}/wp-json/wp/v2/posts`;

    const auth = Buffer.from(
      `${config.username}:${config.applicationPassword}`
    ).toString("base64");

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        title: article.title ?? "Untitled",
        content: htmlContent,
        slug: article.slug ?? undefined,
        excerpt: article.metaDescription ?? undefined,
        status: draft ? "draft" : "publish",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: `WordPress API error (${response.status}): ${errorBody}`,
      };
    }

    const data = await response.json();

    return {
      success: true,
      postId: data.id,
      url: data.link,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unknown WordPress publish error",
    };
  }
}

/**
 * Test WordPress connection by fetching a single post.
 */
export async function testWordPressConnection(
  config: WPConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const siteUrl = config.siteUrl.replace(/\/+$/, "");
    const endpoint = `${siteUrl}/wp-json/wp/v2/posts?per_page=1`;

    const auth = Buffer.from(
      `${config.username}:${config.applicationPassword}`
    ).toString("base64");

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Connection failed (${response.status}): ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
