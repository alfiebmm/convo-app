import { test } from "node:test";
import assert from "node:assert/strict";
import { signWebhookPayload } from "@/lib/connectors/webhook/sign";
import { verifyWebhookSignature } from "@/lib/connectors/webhook/verify";

test("verifyWebhookSignature accepts a valid signature", () => {
  const signed = signWebhookPayload("whsec_test_secret", '{"id":"case_123"}', 100);

  assert.deepEqual(
    verifyWebhookSignature({
      header: signed.header,
      body: '{"id":"case_123"}',
      secret: "whsec_test_secret",
      now: 120,
    }),
    { valid: true },
  );
});

test("verifyWebhookSignature rejects a tampered body as mismatch", () => {
  const signed = signWebhookPayload("whsec_test_secret", '{"id":"case_123"}', 100);

  assert.deepEqual(
    verifyWebhookSignature({
      header: signed.header,
      body: '{"id":"case_456"}',
      secret: "whsec_test_secret",
      now: 120,
    }),
    { valid: false, reason: "mismatch" },
  );
});

test("verifyWebhookSignature rejects an expired timestamp as stale", () => {
  const signed = signWebhookPayload("whsec_test_secret", '{"id":"case_123"}', 100);

  assert.deepEqual(
    verifyWebhookSignature({
      header: signed.header,
      body: '{"id":"case_123"}',
      secret: "whsec_test_secret",
      toleranceSeconds: 10,
      now: 120,
    }),
    { valid: false, reason: "stale" },
  );
});

test("verifyWebhookSignature rejects malformed headers", () => {
  assert.deepEqual(
    verifyWebhookSignature({
      header: "t=100, v1=not-hex",
      body: "{}",
      secret: "whsec_test_secret",
      now: 100,
    }),
    { valid: false, reason: "malformed" },
  );
});

test("verifyWebhookSignature rejects missing headers", () => {
  assert.deepEqual(
    verifyWebhookSignature({
      header: "",
      body: "{}",
      secret: "whsec_test_secret",
    }),
    { valid: false, reason: "missing" },
  );
});

test("verifyWebhookSignature exercises constant-time comparison path", () => {
  const signed = signWebhookPayload("whsec_test_secret", '{"id":"case_123"}', 100);
  const mismatchedHeader = signed.header.replace(/.$/, (char) =>
    char === "0" ? "1" : "0",
  );

  assert.deepEqual(
    verifyWebhookSignature({
      header: mismatchedHeader,
      body: '{"id":"case_123"}',
      secret: "whsec_test_secret",
      now: 100,
    }),
    { valid: false, reason: "mismatch" },
  );
});
