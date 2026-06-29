import { test } from "node:test";
import assert from "node:assert/strict";

import { stripNonTenantAnchors } from "../link-host";

const TENANT_DOMAIN = "doggo.com.au";

test("strips markdown anchor to third-party host", () => {
  const result = stripNonTenantAnchors(
    "Read [Wikipedia](https://en.wikipedia.org/wiki/Dog_food) for context.",
    TENANT_DOMAIN,
  );

  assert.equal(result.content, "Read Wikipedia for context.");
  assert.equal(result.strippedCount, 1);
  assert.deepEqual(result.hosts, ["en.wikipedia.org"]);
});

test("preserves markdown anchor to tenant subdomain", () => {
  const input = "See [docs](https://help.doggo.com.au/articles).";
  const result = stripNonTenantAnchors(input, TENANT_DOMAIN);

  assert.equal(result.content, input);
  assert.equal(result.strippedCount, 0);
});

test("strips only the external markdown anchor in mixed content", () => {
  const result = stripNonTenantAnchors(
    "Use [our guide](https://doggo.com.au/guide) and avoid [Wikipedia](https://en.wikipedia.org/wiki/Dog).",
    TENANT_DOMAIN,
  );

  assert.equal(
    result.content,
    "Use [our guide](https://doggo.com.au/guide) and avoid Wikipedia.",
  );
  assert.equal(result.strippedCount, 1);
});

test("removes bare third-party URL", () => {
  const result = stripNonTenantAnchors(
    "Background: https://nytimes.com/example. Our guide is https://doggo.com.au/guide.",
    TENANT_DOMAIN,
  );

  assert.equal(
    result.content,
    "Background: . Our guide is https://doggo.com.au/guide.",
  );
  assert.equal(result.strippedCount, 1);
  assert.deepEqual(result.hosts, ["nytimes.com"]);
});

test("preserves mailto and tel links", () => {
  const input = "Email [support](mailto:hello@doggo.com.au) or call [us](tel:+61000000000).";
  const result = stripNonTenantAnchors(input, TENANT_DOMAIN);

  assert.equal(result.content, input);
  assert.equal(result.strippedCount, 0);
});
