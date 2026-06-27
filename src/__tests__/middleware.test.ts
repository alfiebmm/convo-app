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
  assert.equal(
    response.headers.get("Cache-Control"),
    NO_STORE_HEADERS["Cache-Control"],
  );
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0, must-revalidate");
});

test("notFoundResponse: sets Vary: Cookie so caches do not share responses across auth states", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  assert.equal(response.headers.get("Vary"), "Cookie");
});

test("notFoundResponse: rewrites to /404 internally", () => {
  const response = notFoundResponse(makeRequest("/platform-admin"));
  // Next rewrites surface the destination on the x-middleware-rewrite header.
  const rewrite = response.headers.get("x-middleware-rewrite");
  assert.ok(rewrite && rewrite.endsWith("/404"), `expected rewrite to /404, got ${rewrite}`);
});
