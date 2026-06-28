import { test } from "node:test";
import assert from "node:assert/strict";
import { signWebhookPayload } from "@/lib/connectors/webhook/sign";

test("signWebhookPayload is deterministic for a fixed timestamp, body, and secret", () => {
  const result = signWebhookPayload(
    "whsec_test_secret",
    '{"event":"case.created","id":"case_123"}',
    1_710_000_000,
  );

  assert.equal(
    result.signature,
    "342db1510384d0e0d4fa85ee93b88ebf22847daaccf00e2db64323f2c4ad889c",
  );
  assert.equal(
    result.header,
    "t=1710000000,v1=342db1510384d0e0d4fa85ee93b88ebf22847daaccf00e2db64323f2c4ad889c",
  );
});

test("signWebhookPayload emits the V1 header format without spaces", () => {
  const result = signWebhookPayload("secret", "body", 1_710_000_000);

  assert.match(result.header, /^t=1710000000,v1=[a-f0-9]{64}$/);
  assert.equal(result.header.includes(" "), false);
});

test("signWebhookPayload signs different bodies differently", () => {
  const first = signWebhookPayload("secret", '{"id":"case_123"}', 1_710_000_000);
  const second = signWebhookPayload("secret", '{"id":"case_456"}', 1_710_000_000);

  assert.notEqual(first.signature, second.signature);
});
