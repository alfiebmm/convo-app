import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { fetchTenantBrand } from "../brand-fetcher";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test("prefers a suitably sized OG image", async () => {
  mockHtml(`
    <title>Doggo</title>
    <meta property="og:image" content="/og.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple.png">
  `);

  const result = await fetchTenantBrand("doggo.com.au");

  assert.equal(result.logo?.url, "https://doggo.com.au/og.png");
  assert.equal(result.logo?.source, "og:image");
  assert.equal(result.logo?.alt, "Doggo");
});

test("skips an explicitly tiny OG image and falls back to apple touch icon", async () => {
  mockHtml(`
    <title>Doggo</title>
    <meta property="og:image" content="/tiny.png">
    <meta property="og:image:width" content="80">
    <meta property="og:image:height" content="80">
    <link rel="apple-touch-icon" sizes="120x120" href="/small.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/large.png">
  `);

  const result = await fetchTenantBrand("doggo.com.au");

  assert.equal(result.logo?.url, "https://doggo.com.au/large.png");
  assert.equal(result.logo?.source, "apple-touch-icon");
});

test("uses favicon.ico as the final fallback", async () => {
  mockHtml("<title>Doggo</title>");

  const result = await fetchTenantBrand("https://doggo.com.au");

  assert.equal(result.logo?.url, "https://doggo.com.au/favicon.ico");
  assert.equal(result.logo?.source, "favicon");
});

test("uses the largest non-favicon icon candidate", async () => {
  mockHtml(`
    <link rel="icon" sizes="16x16" href="/tiny.png">
    <link rel="icon" sizes="64x64" href="/favicon.ico">
    <link rel="icon" sizes="32x32" href="/logo-32.png">
    <link rel="icon" sizes="96x96" href="/logo-96.png">
  `);

  const result = await fetchTenantBrand("doggo.com.au");

  assert.equal(result.logo?.url, "https://doggo.com.au/logo-96.png");
  assert.equal(result.logo?.source, "icon");
});

test("resolves relative URLs against the final response URL", async () => {
  mockHtml(
    `<meta property="og:image" content="../assets/logo.webp">`,
    "https://www.doggo.com.au/landing/page",
  );

  const result = await fetchTenantBrand("doggo.com.au");

  assert.equal(result.logo?.url, "https://www.doggo.com.au/assets/logo.webp");
});

test("returns clear errors on HTTP failure", async () => {
  global.fetch = async () => new Response("nope", { status: 500 });

  const result = await fetchTenantBrand("doggo.com.au");

  assert.equal(result.logo, null);
  assert.deepEqual(result.errors, ["Fetch failed with HTTP 500"]);
});

test("returns clear errors on timeout", async () => {
  global.fetch = async () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";
    throw error;
  };

  const result = await fetchTenantBrand("doggo.com.au");

  assert.equal(result.logo, null);
  assert.deepEqual(result.errors, ["Fetch timed out after 10000ms"]);
});

test("reports no candidates when the root is not HTTPS", async () => {
  mockHtml(`<link rel="icon" sizes="32x32" href="/icon.png">`, "http://doggo.com.au/");

  const result = await fetchTenantBrand("http://doggo.com.au");

  assert.equal(result.logo, null);
  assert.deepEqual(result.errors, ["No suitable logo candidate found"]);
});

test("resolves protocol-relative URLs as HTTPS", async () => {
  mockHtml(`<meta property="og:image" content="//cdn.doggo.com.au/logo.png">`);

  const result = await fetchTenantBrand("doggo.com.au");

  assert.equal(result.logo?.url, "https://cdn.doggo.com.au/logo.png");
});

test("extracts site name from og:site_name and theme colour", async () => {
  mockHtml(`
    <title>Ignored</title>
    <meta property="og:site_name" content="AgPages">
    <meta name="theme-color" content="#336699">
    <meta property="og:image" content="/logo.png">
  `);

  const result = await fetchTenantBrand("agpages.com.au");

  assert.equal(result.siteName, "AgPages");
  assert.equal(result.themeColor, "#336699");
  assert.equal(result.logo?.alt, "AgPages");
});

function mockHtml(html: string, url = "https://doggo.com.au/") {
  global.fetch = async () =>
    ({
      ok: true,
      status: 200,
      url,
      text: async () => html,
    }) as Response;
}
