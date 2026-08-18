import * as cheerio from "cheerio";

export type BrandFetchResult = {
  logo: {
    url: string;
    source: "og:image" | "apple-touch-icon" | "icon" | "favicon";
    alt: string;
  } | null;
  siteName: string | null;
  themeColor: string | null;
  errors: string[];
};

type Candidate = {
  url: string;
  source: NonNullable<BrandFetchResult["logo"]>["source"];
  area: number;
};

const USER_AGENT = "ConvoBot/1.0 (Brand Fetcher)";

export async function fetchTenantBrand(
  domain: string,
): Promise<BrandFetchResult> {
  const errors: string[] = [];
  const rootUrl = normaliseRootUrl(domain);
  if (!rootUrl) {
    return {
      logo: null,
      siteName: null,
      themeColor: null,
      errors: [`Invalid domain: ${domain}`],
    };
  }

  try {
    const response = await fetch(rootUrl, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        logo: null,
        siteName: null,
        themeColor: null,
        errors: [`Fetch failed with HTTP ${response.status}`],
      };
    }

    const html = await response.text();
    const baseUrl = response.url || rootUrl;
    const $ = cheerio.load(html);
    const siteName =
      readMeta($, 'meta[property="og:site_name"]') ||
      $("title").first().text().replace(/\s+/g, " ").trim() ||
      null;
    const themeColor = readMeta($, 'meta[name="theme-color"]');
    const alt = siteName || new URL(baseUrl).hostname.replace(/^www\./, "");
    const logo = selectLogo($, baseUrl, alt);

    if (!logo) {
      errors.push("No suitable logo candidate found");
    }

    return {
      logo,
      siteName,
      themeColor,
      errors,
    };
  } catch (error) {
    return {
      logo: null,
      siteName: null,
      themeColor: null,
      errors: [formatFetchError(error)],
    };
  }
}

function selectLogo(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  alt: string,
): BrandFetchResult["logo"] {
  const ogImage = readMeta($, 'meta[property="og:image"]');
  if (ogImage) {
    const width = readNumber(readMeta($, 'meta[property="og:image:width"]'));
    const height = readNumber(readMeta($, 'meta[property="og:image:height"]'));
    const hasExplicitSize = width !== null || height !== null;
    const explicitSizeOk =
      (width === null || width > 100) && (height === null || height > 100);
    if (!hasExplicitSize || explicitSizeOk) {
      const url = resolveHttpsUrl(ogImage, baseUrl);
      if (url) return { url, source: "og:image", alt };
    }
  }

  const appleTouchIcons = linkCandidates($, baseUrl, "apple-touch-icon");
  const appleTouchIcon = largest(appleTouchIcons);
  if (appleTouchIcon) {
    return { url: appleTouchIcon.url, source: "apple-touch-icon", alt };
  }

  const icons = linkCandidates($, baseUrl, "icon").filter(
    (candidate) =>
      candidate.area !== 16 * 16 &&
      !new URL(candidate.url).pathname.toLowerCase().endsWith("/favicon.ico"),
  );
  const icon = largest(icons);
  if (icon) {
    return { url: icon.url, source: "icon", alt };
  }

  const favicon = resolveHttpsUrl("/favicon.ico", baseUrl);
  return favicon ? { url: favicon, source: "favicon", alt } : null;
}

function linkCandidates(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  relToken: "apple-touch-icon" | "icon",
): Candidate[] {
  const candidates: Candidate[] = [];
  $("link[rel][href]").each((_, element) => {
    const rel = ($(element).attr("rel") || "").toLowerCase().split(/\s+/);
    if (!rel.includes(relToken)) return;
    if (relToken === "icon" && rel.includes("apple-touch-icon")) return;

    const href = $(element).attr("href");
    const url = href ? resolveHttpsUrl(href, baseUrl) : null;
    if (!url) return;
    candidates.push({
      url,
      source: relToken,
      area: parseLargestSize($(element).attr("sizes")),
    });
  });
  return candidates;
}

function largest(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.area - a.area)[0] ?? null;
}

function parseLargestSize(raw: string | undefined): number {
  if (!raw) return 0;
  if (raw.toLowerCase() === "any") return Number.MAX_SAFE_INTEGER;
  let largestArea = 0;
  for (const size of raw.split(/\s+/)) {
    const match = size.match(/^(\d+)x(\d+)$/i);
    if (!match) continue;
    largestArea = Math.max(
      largestArea,
      Number(match[1]) * Number(match[2]),
    );
  }
  return largestArea;
}

function readMeta($: cheerio.CheerioAPI, selector: string): string | null {
  const value = $(selector).first().attr("content")?.trim();
  return value || null;
}

function readNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveHttpsUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function normaliseRootUrl(domain: string): string | null {
  try {
    const trimmed = domain.trim().replace(/\/+$/, "");
    if (!trimmed) return null;
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function formatFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "Fetch timed out after 10000ms";
    }
    return error.message;
  }
  return "Fetch failed";
}
