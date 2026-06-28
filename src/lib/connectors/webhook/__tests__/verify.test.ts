import { test } from "node:test";
import assert from "node:assert/strict";
import { signWebhookPayload } from "../sign";
import { verifyWebhookSignature } from "../verify";

test("verifyWebhookSignature returns valid for a fresh, untampered signature", () => {
  const secret = "whsec_verify_ok";
  const body = '{"event":"case.created"}';
  const now = 1_730_000_000;

  const { header } = signWebhookPayload(secret, body, now);
  const result = verifyWebhookSignature({ header, body, secret, now });

  assert.deepEqual(result, { valid: true });
});

test("verifyWebhookSignature flags missing header", () => {
  assert.deepEqual(
    verifyWebhookSignature({
      header: null,
      body: "x",
      secret: "s",
    }),
    { valid: false, reason: "missing" },
  );
  assert.deepEqual(
    verifyWebhookSignature({
      header: "",
      body: "x",
      secret: "s",
    }),
    { valid: false, reason: "missing" },
  );
});

test("verifyWebhookSignature flags malformed header (no t= or v1=)", () => {
  const result = verifyWebhookSignature({
    header: "not-a-signature",
    body: "x",
    secret: "s",
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "malformed");
});

test("verifyWebhookSignature flags malformed header (non-numeric timestamp)", () => {
  const result = verifyWebhookSignature({
    header: "t=abc,v1=deadbeef",
    body: "x",
    secret: "s",
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "malformed");
});

test("verifyWebhookSignature flags malformed header (non-hex v1)", () => {
  const result = verifyWebhookSignature({
    header: "t=1,v1=not-hex-zzzz",
    body: "x",
    secret: "s",
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "malformed");
});

test("verifyWebhookSignature flags malformed header (missing v1 part)", () => {
  const result = verifyWebhookSignature({
    header: "t=1730000000",
    body: "x",
    secret: "s",
    now: 1_730_000_000,
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "malformed");
});

test("verifyWebhookSignature flags stale timestamp (older than tolerance)", () => {
  const secret = "whsec_stale";
  const body = "body";
  const signedAt = 1_730_000_000;
  const { header } = signWebhookPayload(secret, body, signedAt);

  const result = verifyWebhookSignature({
    header,
    body,
    secret,
    now: signedAt + 1000, // tolerance default 300
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "stale");
});

test("verifyWebhookSignature flags stale timestamp (future beyond tolerance)", () => {
  const secret = "whsec_future";
  const body = "body";
  const signedAt = 1_730_000_000;
  const { header } = signWebhookPayload(secret, body, signedAt);

  const result = verifyWebhookSignature({
    header,
    body,
    secret,
    now: signedAt - 1000,
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "stale");
});

test("verifyWebhookSignature respects a custom toleranceSeconds", () => {
  const secret = "whsec_custom_tol";
  const body = "body";
  const signedAt = 1_730_000_000;
  const { header } = signWebhookPayload(secret, body, signedAt);

  // Default tolerance (300s) would reject this; a wider window accepts.
  const result = verifyWebhookSignature({
    header,
    body,
    secret,
    now: signedAt + 600,
    toleranceSeconds: 900,
  });
  assert.deepEqual(result, { valid: true });
});

test("verifyWebhookSignature flags mismatch when body is tampered", () => {
  const secret = "whsec_tamper";
  const now = 1_730_000_000;

  const { header } = signWebhookPayload(secret, "original-body", now);
  const result = verifyWebhookSignature({
    header,
    body: "tampered-body",
    secret,
    now,
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "mismatch");
});

test("verifyWebhookSignature flags mismatch when secret is wrong", () => {
  const body = "body";
  const now = 1_730_000_000;

  const { header } = signWebhookPayload("secret-A", body, now);
  const result = verifyWebhookSignature({
    header,
    body,
    secret: "secret-B",
    now,
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "mismatch");
});

test("verifyWebhookSignature mismatch path handles same-length non-matching hex (constant-time comparator)", () => {
  // Build a header with a v1 of the correct sha256-hex length (64 chars)
  // but that does not match. Exercises the timingSafeEqual path rather
  // than the length-mismatch short-circuit.
  const body = "body";
  const now = 1_730_000_000;
  const fakeSig = "0".repeat(64);
  const header = `t=${now},v1=${fakeSig}`;

  const result = verifyWebhookSignature({
    header,
    body,
    secret: "whsec_constant_time",
    now,
  });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "mismatch");
});

test("verifyWebhookSignature tolerates unknown forward-compatible header keys", () => {
  const secret = "whsec_forward_compat";
  const body = "body";
  const now = 1_730_000_000;
  const { signature } = signWebhookPayload(secret, body, now);

  const header = `t=${now},v1=${signature},v2=ignoreme`;
  const result = verifyWebhookSignature({ header, body, secret, now });

  assert.deepEqual(result, { valid: true });
});
