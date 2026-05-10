/**
 * Site crawler for knowledge indexing (CON-85)
 * 
 * Crawls a tenant's domain to extract pages, titles, content, and metadata.
 * Strategy: sitemap.xml first, BFS fallback, same-origin only.
 * Performance: concurrency 5, 200ms throttle, 200 page cap, 60s soft timeout.
 */
import * as cheerio from "cheerio";

export interface CrawledPage {
  url: string;
  title: string;
  h1: string | null;
  metaDescription: string | null;
  bodyText: string;
  internalLinks: string[];
}

interface CrawlOptions {
  maxPages?: number;
  timeoutMs?: number;
  concurrency?: number;
  throttleMs?: number;
}

const DEFAULT_OPTIONS: Required<CrawlOptions> = {
  maxPages: 200,
  timeoutMs: 60000,
  concurrency: 5,
  throttleMs: 200,
};

/**
 * Crawl a domain and return all discovered pages.
 *
 * Origin resolution: the tenant's stored domain is often the apex ("doggo.com.au")
 * but the live site lives on www ("www.doggo.com.au"). A naive same-origin check
 * would reject every page coming back from a redirect. We:
 *   1. Probe the base URL with redirects followed and use the FINAL response's
 *      URL origin as the canonical crawl origin.
 *   2. Treat apex and www as equivalent in `isSameOrigin` so sitemap-listed URLs
 *      that don't go through redirect still match.
 */
export async function crawlSite(
  domain: string,
  options: CrawlOptions = {}
): Promise<CrawledPage[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Normalize domain to base URL
  const rawBaseUrl = normalizeBaseUrl(domain);

  // Probe the base URL once and use the FINAL URL after redirects. This makes
  // `doggo.com.au` resolve to `https://www.doggo.com.au` as the canonical
  // origin, so the same-origin filter doesn't drop every fetched page.
  let baseUrl = rawBaseUrl;
  let origin = new URL(rawBaseUrl).origin;
  try {
    const probe = await fetch(rawBaseUrl, {
      headers: { "User-Agent": "ConvoBot/1.0 (Site Indexer)" },
      signal: AbortSignal.timeout(10000),
      redirect: "follow",
    });
    if (probe.url) {
      baseUrl = probe.url;
      origin = new URL(probe.url).origin;
    }
  } catch (err) {
    console.warn(`[Crawler] Probe failed for ${rawBaseUrl}, falling back to raw origin:`, err);
  }
  if (origin !== new URL(rawBaseUrl).origin) {
    console.log(`[Crawler] Origin resolved via redirect: ${rawBaseUrl} -> ${origin}`);
  }

  const visited = new Set<string>();
  const queue: string[] = [baseUrl];
  const results: CrawledPage[] = [];

  // Try to fetch sitemap.xml first
  const sitemapUrls = await fetchSitemap(baseUrl);
  if (sitemapUrls.length > 0) {
    console.log(`[Crawler] Found ${sitemapUrls.length} URLs in sitemap.xml`);
    // Same-origin filter early so we don't queue thousands of cross-origin URLs.
    const sameOrigin = sitemapUrls.filter((u) => isSameOrigin(u, origin));
    if (sameOrigin.length !== sitemapUrls.length) {
      console.log(
        `[Crawler] Filtered ${sitemapUrls.length - sameOrigin.length} cross-origin sitemap URLs`
      );
    }
    // Cap queue from sitemap to maxPages * 2 to prevent runaway queues on
    // mega-sitemaps (e.g. doggo's breed*city combinatorial pages).
    queue.push(...sameOrigin.slice(0, opts.maxPages * 2));
  }

  // Check robots.txt for disallowed paths
  const disallowedPaths = await fetchRobotsTxt(baseUrl);

  // BFS crawl
  while (queue.length > 0 && results.length < opts.maxPages) {
    // Check timeout
    if (Date.now() - startTime > opts.timeoutMs) {
      console.warn(`[Crawler] Soft timeout reached after ${opts.timeoutMs}ms`);
      break;
    }
    
    // Process batch concurrently
    const batch = queue.splice(0, opts.concurrency);
    const batchPromises = batch.map(async (url) => {
      if (visited.has(url)) return;
      visited.add(url);
      
      // Skip disallowed paths
      if (isDisallowed(url, origin, disallowedPaths)) {
        return;
      }
      
      try {
        const page = await fetchPage(url, origin);
        if (page) {
          results.push(page);
          
          // Add internal links to queue
          for (const link of page.internalLinks) {
            if (!visited.has(link) && !queue.includes(link)) {
              queue.push(link);
            }
          }
        }
      } catch (error) {
        console.error(`[Crawler] Failed to fetch ${url}:`, error);
      }
      
      // Throttle
      await sleep(opts.throttleMs);
    });
    
    await Promise.all(batchPromises);
  }
  
  console.log(`[Crawler] Completed: ${results.length} pages indexed from ${domain}`);
  return results;
}

/**
 * Fetch and parse a single page.
 */
async function fetchPage(url: string, origin: string): Promise<CrawledPage | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ConvoBot/1.0 (Site Indexer)",
      },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      return null;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Remove script and style tags
    $("script, style, noscript, iframe").remove();
    
    // Extract title
    const title = $("title").first().text().trim() || $("h1").first().text().trim() || url;
    
    // Extract H1
    const h1 = $("h1").first().text().trim() || null;
    
    // Extract meta description
    const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
    
    // Extract body text
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    
    // Extract internal links (same origin)
    const internalLinks: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        const absoluteUrl = resolveUrl(href, url);
        if (absoluteUrl && isSameOrigin(absoluteUrl, origin)) {
          internalLinks.push(absoluteUrl);
        }
      }
    });
    
    return {
      url,
      title,
      h1,
      metaDescription,
      bodyText,
      internalLinks: [...new Set(internalLinks)], // dedupe
    };
  } catch (error) {
    console.error(`[Crawler] Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Fetch sitemap.xml and extract URLs.
 */
async function fetchSitemap(baseUrl: string): Promise<string[]> {
  try {
    const sitemapUrl = new URL("/sitemap.xml", baseUrl).href;
    const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) });
    
    if (!response.ok) return [];
    
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const urls: string[] = [];
    $("url > loc").each((_, el) => {
      const url = $(el).text().trim();
      if (url) urls.push(url);
    });
    
    // Also check for sitemap index
    $("sitemap > loc").each((_, el) => {
      const url = $(el).text().trim();
      if (url) urls.push(url);
    });
    
    return urls;
  } catch {
    return [];
  }
}

/**
 * Fetch robots.txt and extract disallowed paths.
 */
async function fetchRobotsTxt(baseUrl: string): Promise<string[]> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const response = await fetch(robotsUrl, { signal: AbortSignal.timeout(3000) });
    
    if (!response.ok) return [];
    
    const text = await response.text();
    const disallowed: string[] = [];
    
    for (const line of text.split("\n")) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith("disallow:")) {
        const path = trimmed.substring(9).trim();
        if (path && path !== "/") {
          disallowed.push(path);
        }
      }
    }
    
    return disallowed;
  } catch {
    return [];
  }
}

/**
 * Check if URL is disallowed by robots.txt.
 */
function isDisallowed(url: string, origin: string, disallowedPaths: string[]): boolean {
  if (disallowedPaths.length === 0) return false;
  
  try {
    const pathname = new URL(url).pathname;
    return disallowedPaths.some((path) => pathname.startsWith(path));
  } catch {
    return false;
  }
}

/**
 * Resolve relative URL to absolute.
 */
function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    // Skip non-http protocols and anchors
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return null;
    }
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Check if URL is same origin, treating apex and www subdomain as equivalent.
 *
 * Real-world tenants store the apex ("doggo.com.au") but the live site is on
 * www. Strict origin comparison would drop every URL after the apex->www
 * redirect. We compare the apex form of both hosts.
 */
function isSameOrigin(url: string, origin: string): boolean {
  try {
    const a = new URL(url);
    const b = new URL(origin);
    if (a.protocol !== b.protocol) return false;
    if (a.port !== b.port) return false;
    const apex = (h: string) => (h.startsWith("www.") ? h.slice(4) : h);
    return apex(a.hostname.toLowerCase()) === apex(b.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Normalize domain input to base URL.
 */
function normalizeBaseUrl(domain: string): string {
  if (!domain.startsWith("http")) {
    return `https://${domain}`;
  }
  return domain;
}

/**
 * Sleep utility for throttling.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
