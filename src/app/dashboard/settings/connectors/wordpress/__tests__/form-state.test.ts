import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  canSaveWordPressForm,
  wordpressFormKey,
  wordpressFormValidationError,
} from "../form-state";
import { WordPressInlineBanner } from "../wordpress-settings-panel";

const validValues = {
  siteUrl: "https://example.com",
  username: "admin",
  applicationPassword: ["wp", "application", "password", "keeps", "spaces"].join(" "),
};

test("WordPress form only enables Save after a successful test of the current values", () => {
  assert.equal(canSaveWordPressForm(validValues, null, null), false);

  const successfulKey = wordpressFormKey(validValues);
  assert.equal(canSaveWordPressForm(validValues, successfulKey, null), true);

  assert.equal(
    canSaveWordPressForm(
      { ...validValues, username: "other-admin" },
      successfulKey,
      null,
    ),
    false,
  );
});

test("WordPress form validation accepts application passwords with spaces", () => {
  assert.equal(wordpressFormValidationError(validValues, null), null);
});

test("WordPress form asks for the application password again when hydrated with a mask", () => {
  const masked = "••••••••aces";
  const values = {
    siteUrl: "https://example.com",
    username: "admin",
    applicationPassword: masked,
  };

  assert.equal(
    wordpressFormValidationError(values, masked),
    "Enter the WordPress application password again before testing.",
  );
  assert.equal(canSaveWordPressForm(values, wordpressFormKey(values), masked), false);
});

test("WordPress form surfaces URL validation before testing", () => {
  assert.equal(
    wordpressFormValidationError(
      { ...validValues, siteUrl: "ftp://example.com" },
      null,
    ),
    "Enter a valid WordPress site URL.",
  );
});

test("WordPress connection error banner renders exact connector error text", () => {
  const html = renderToStaticMarkup(
    createElement(WordPressInlineBanner, {
      banner: {
        tone: "error",
        message: "WordPress credentials were rejected",
      },
    }),
  );

  assert.match(html, /role="alert"/);
  assert.match(html, /WordPress credentials were rejected/);
});
