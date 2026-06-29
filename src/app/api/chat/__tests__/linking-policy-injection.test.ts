import { test } from "node:test";
import assert from "node:assert/strict";

import { finaliseChatLinkPolicy } from "../route";

const TENANT_ID = "tenant-1";
const TENANT_DOMAIN = "doggo.com.au";

interface ChatInjectionFixture {
  name: string;
  llmResponse: string;
  expectedContent: string;
  expectedLogs: Array<{
    event: "link_policy_strip";
    tenant_id: string;
    anchor_count: number;
    hosts: string[];
  }>;
}

const FIXTURES: ChatInjectionFixture[] = [
  {
    name: "wikipedia anchor stripped",
    llmResponse:
      "Read [Wikipedia](https://wikipedia.org/wiki/Dog_food) for more context.",
    expectedContent: "Read Wikipedia for more context.",
    expectedLogs: [
      {
        event: "link_policy_strip",
        tenant_id: TENANT_ID,
        anchor_count: 1,
        hosts: ["wikipedia.org"],
      },
    ],
  },
  {
    name: "mixed internal and external links",
    llmResponse:
      "Use [our feeding guide](https://help.doggo.com.au/feeding) before reading [coverage](https://nytimes.com/x).",
    expectedContent:
      "Use [our feeding guide](https://help.doggo.com.au/feeding) before reading coverage.",
    expectedLogs: [
      {
        event: "link_policy_strip",
        tenant_id: TENANT_ID,
        anchor_count: 1,
        hosts: ["nytimes.com"],
      },
    ],
  },
  {
    name: "bare URL stripped",
    llmResponse: "For background, see https://nytimes.com/x in prose.",
    expectedContent: "For background, see  in prose.",
    expectedLogs: [
      {
        event: "link_policy_strip",
        tenant_id: TENANT_ID,
        anchor_count: 1,
        hosts: ["nytimes.com"],
      },
    ],
  },
  {
    name: "tenant subdomain preserved",
    llmResponse: "Read [our blog](https://blog.doggo.com.au/post).",
    expectedContent: "Read [our blog](https://blog.doggo.com.au/post).",
    expectedLogs: [],
  },
  {
    name: "mailto and tel preserved",
    llmResponse:
      "Contact [email](mailto:hello@example.com) or [call us](tel:+61400111222).",
    expectedContent:
      "Contact [email](mailto:hello@example.com) or [call us](tel:+61400111222).",
    expectedLogs: [],
  },
  {
    name: "deceptive anchor text preserved after external URL stripped",
    llmResponse: "Payment detail is at [stripe.com](https://wikipedia.org).",
    expectedContent: "Payment detail is at stripe.com.",
    expectedLogs: [
      {
        event: "link_policy_strip",
        tenant_id: TENANT_ID,
        anchor_count: 1,
        hosts: ["wikipedia.org"],
      },
    ],
  },
];

function runMockLlmThroughFinaliser(llmResponse: string): {
  content: string;
  logs: Record<string, unknown>[];
} {
  const logs: Record<string, unknown>[] = [];

  const content = finaliseChatLinkPolicy({
    content: llmResponse,
    tenantId: TENANT_ID,
    tenantDomain: TENANT_DOMAIN,
    log: (payload) => logs.push(payload),
  });

  return { content, logs };
}

for (const fixture of FIXTURES) {
  test(`chat finaliser handles injection fixture: ${fixture.name}`, () => {
    const { content, logs } = runMockLlmThroughFinaliser(fixture.llmResponse);

    assert.equal(content, fixture.expectedContent);
    assert.deepEqual(logs, fixture.expectedLogs);
  });
}
