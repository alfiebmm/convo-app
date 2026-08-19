import { test } from "node:test";
import assert from "node:assert/strict";

import { isHttpsUrl, pickHeroPlaceholderColour } from "../hero-placeholder";

test("pickHeroPlaceholderColour matches representative brand colours", () => {
  assert.equal(pickHeroPlaceholderColour("#FF6B2C"), "orange");
  assert.equal(pickHeroPlaceholderColour("#2e6dff"), "blue");
  assert.equal(pickHeroPlaceholderColour("#2e7d32"), "green");
  assert.equal(pickHeroPlaceholderColour("#71717A"), "neutral");
});

test("pickHeroPlaceholderColour handles shorthand and invalid colours", () => {
  assert.equal(pickHeroPlaceholderColour("#f60"), "orange");
  assert.equal(pickHeroPlaceholderColour("not-a-colour"), "neutral");
});

test("isHttpsUrl only accepts absolute HTTPS URLs", () => {
  assert.equal(isHttpsUrl("https://example.com/image.jpg"), true);
  assert.equal(isHttpsUrl("http://example.com/image.jpg"), false);
  assert.equal(isHttpsUrl("/hero-placeholders/gradient-orange.jpg"), false);
  assert.equal(isHttpsUrl(null), false);
});
