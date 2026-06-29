import { test } from "node:test";
import assert from "node:assert/strict";

import { finaliseChatLinkPolicy } from "../route";

test("chat finaliser strips external markdown links and logs structured policy event", () => {
  const logs: Record<string, unknown>[] = [];

  const content = finaliseChatLinkPolicy({
    content:
      "Read [Wikipedia](https://en.wikipedia.org/wiki/Dog_food) and our [feeding guide](https://doggo.com.au/feeding).",
    tenantId: "tenant-1",
    tenantDomain: "doggo.com.au",
    log: (payload) => logs.push(payload),
  });

  assert.equal(
    content,
    "Read Wikipedia and our [feeding guide](https://doggo.com.au/feeding).",
  );
  assert.deepEqual(logs, [
    {
      event: "link_policy_strip",
      tenant_id: "tenant-1",
      anchor_count: 1,
      hosts: ["en.wikipedia.org"],
    },
  ]);
});

test("chat finaliser preserves content when only tenant links are present", () => {
  const logs: Record<string, unknown>[] = [];
  const input = "See [feeding guide](https://help.doggo.com.au/feeding).";

  const content = finaliseChatLinkPolicy({
    content: input,
    tenantId: "tenant-1",
    tenantDomain: "doggo.com.au",
    log: (payload) => logs.push(payload),
  });

  assert.equal(content, input);
  assert.deepEqual(logs, []);
});
