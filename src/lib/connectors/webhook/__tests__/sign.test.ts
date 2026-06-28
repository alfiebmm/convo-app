import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { signWebhookPayload } from "../sign";

test("signWebhookPayload is deterministic for a fixed (secret, body, timestamp)", () => {
  const secret = "whsec_fixed";
  const body = '{"event":"case.created","id":"abc"}';
  const timestamp = 1_730_000_000;

  const a = signWebhookPayload(secret, body, timestamp);
  const b = signWebhookPayload(secret, body, timestamp);

  assert.equal(a.signature, b.signature);
  assert.equal(a.header, b.header);
  assert.equal(a.timestamp, timestamp);
});

test("signWebhookPayload signature matches an independent HMAC-SHA256 of <ts>.<body>", () => {
  const secret = "whsec_independent";
  const body = "raw-body-bytes";
  const timestamp = 1_700_000_123;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");

  const { signature, header } = signWebhookPayload(secret, body, timestamp);

  assert.equal(signature, expected);
  assert.equal(header, `t=${timestamp},v1=${expected}`);
});

test("signWebhookPayload header has no spaces and uses the t=,v1= shape", () => {
  const { header } = signWebhookPayload("s", "b", 1234567890);

  assert.ok(!/\s/.test(header), "header must contain no whitespace");
  assert.match(header, /^t=\d+,v1=[0-9a-f]+$/);
});

test("signWebhookPayload changes signature when the body changes", () => {
  const secret = "whsec_body_change";
  const ts = 1_730_000_000;

  const a = signWebhookPayload(secret, "body-A", ts);
  const b = signWebhookPayload(secret, "body-B", ts);

  assert.notEqual(a.signature, b.signature);
});

test("signWebhookPayload defaults the timestamp to current unix seconds", () => {
  const before = Math.floor(Date.now() / 1000);
  const result = signWebhookPayload("s", "b");
  const after = Math.floor(Date.now() / 1000);

  assert.ok(result.timestamp >= before);
  assert.ok(result.timestamp <= after);
});

test("signWebhookPayload throws if the secret is empty", () => {
  assert.throws(
    () => signWebhookPayload("", "body"),
    /signWebhookPayload requires a non-empty secret/,
  );
});

test("signWebhookPayload floors fractional timestamps", () => {
  const a = signWebhookPayload("s", "b", 1_730_000_000.9);
  assert.equal(a.timestamp, 1_730_000_000);
});
