import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { NO_STORE_HEADERS, notFoundResponse } from "../middleware";

function makeRequest(pathname: string): NextRequest {
  return new NextRequest(new URL(`https://app.convoapp.com.au${pathname}`));
}

test("notFoundResponse: returns status 404", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  assert.equal(response.status, 404);
});

test("notFoundResponse: sets Cache-Control no-store so edge layers cannot cache the 404", () => {
  const response = notFoundResponse(makeRequest("/platform-admin/enrol-mfa"));
  const cacheControl = response.headers.get("Cache-Control");
  assert.ok(
    cacheControl && cacheControl.includes("no-store"),
    `expected Cache-Control to include "no-store", got ${cacheControl}`,
  );
  assert.equal(cacheControl, NO_STORE_HEADERS["Cache-Control"]);
  assert.equal(cacheControl, "no-store, max-age=0, must-revalidate");
});

test("notFoundResponse: sets Vary: Cookie so caches do not share responses across auth states", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  assert.equal(response.headers.get("Vary"), "Cookie");
});

test("notFoundResponse: sets Vercel-CDN-Cache-Control: no-store to force CDN bypass", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  assert.equal(response.headers.get("Vercel-CDN-Cache-Control"), "no-store");
});

test("notFoundResponse: sets CDN-Cache-Control: no-store as standardised CDN override", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
});

test("notFoundResponse: returns a direct 404 (not a rewrite to /404)", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  // The previous implementation used NextResponse.rewrite("/404") which set
  // x-middleware-rewrite. The fix returns a direct response so this header
  // must NOT be present (otherwise Vercel's edge cache associates the
  // response with the static /404 asset and serves cached HITs).
  assert.equal(response.headers.get("x-middleware-rewrite"), null);
  assert.equal(response.status, 404);
});

test("notFoundResponse: returns a short text/plain body", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  const contentType = response.headers.get("Content-Type");
  assert.ok(
    contentType && contentType.includes("text/plain"),
    `expected Content-Type to include "text/plain", got ${contentType}`,
  );
});
