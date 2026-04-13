/**
 * Generic / Custom Publishing Service
 *
 * A fully configurable REST API publisher for any CMS or blog platform.
 * Uses a JSON body template with placeholder substitution.
 */
import { marked } from "marked";

export interface GenericConfig {
  name: string;
  endpoint: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
  authType: "none" | "basic" | "bearer" | "custom";
  authValue?: string;
  bodyTemplate: string;
  responseUrlPath?: string;
  responseIdPath?: string;
}

export interface GenericPublishResult {
  success: boolean;
  postId?: string;
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
 * Resolve a dot-notation path on an object.
 * e.g. getNestedValue({ data: { url: "https://..." } }, "data.url") → "https://..."
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Replace template placeholders with content values.
 */
function renderTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, val] of Object.entries(values)) {
    // Escape special JSON characters in the value
    const escaped = val
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), escaped);
  }
  return result;
}

/**
 * Build auth headers based on config.
 */
function buildAuthHeaders(config: GenericConfig): Record<string, string> {
  switch (config.authType) {
    case "basic": {
      const encoded = Buffer.from(config.authValue ?? "").toString("base64");
      return { Authorization: `Basic ${encoded}` };
    }
    case "bearer":
      return { Authorization: `Bearer ${config.authValue ?? ""}` };
    case "custom":
      // Custom auth is handled entirely via config.headers
      return {};
    case "none":
    default:
      return {};
  }
}

/**
 * Publish content via a generic REST API.
 */
export async function publishToGeneric(
  config: GenericConfig,
  article: ContentRecord
): Promise<GenericPublishResult> {
  try {
    const htmlContent = article.body ? await marked.parse(article.body) : "";

    const templateValues: Record<string, string> = {
      title: article.title ?? "",
      slug: article.slug ?? "",
      body_html: htmlContent,
      body_markdown: article.body ?? "",
      meta_description: article.metaDescription ?? "",
      excerpt: article.metaDescription ?? "",
    };

    const renderedBody = renderTemplate(config.bodyTemplate, templateValues);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
      ...buildAuthHeaders(config),
    };

    const response = await fetch(config.endpoint, {
      method: config.method,
      headers,
      body: renderedBody,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: `API error (${response.status}): ${errorBody}`,
      };
    }

    const data = await response.json();

    const url = config.responseUrlPath
      ? (getNestedValue(data, config.responseUrlPath) as string | undefined)
      : undefined;

    const postId = config.responseIdPath
      ? String(getNestedValue(data, config.responseIdPath) ?? "")
      : undefined;

    return {
      success: true,
      postId: postId || undefined,
      url: url || undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown publish error",
    };
  }
}

/**
 * Test generic connection by sending a GET to the endpoint base URL.
 */
export async function testGenericConnection(
  config: Pick<GenericConfig, "endpoint" | "headers" | "authType" | "authValue">
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract base URL (protocol + host)
    const url = new URL(config.endpoint);
    const baseUrl = `${url.protocol}//${url.host}`;

    const headers: Record<string, string> = {
      ...(config.headers ?? {}),
      ...buildAuthHeaders(config as GenericConfig),
    };

    const response = await fetch(baseUrl, {
      method: "GET",
      headers,
    });

    // Accept any 2xx or 3xx as "reachable"
    if (response.status >= 400) {
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
