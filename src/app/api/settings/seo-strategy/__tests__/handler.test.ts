import { test } from "node:test";
import assert from "node:assert/strict";

import {
  handleSeoStrategyGet,
  handleSeoStrategyPatch,
  type SeoStrategyPayload,
  type SeoStrategyRecord,
} from "../handler";

async function json(response: Response) {
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

test("SEO strategy handler round-trips tenant strategy CRUD", async () => {
  const store = new Map<string, SeoStrategyRecord>();
  const deps = {
    getStrategy: async (tenantId: string) => store.get(tenantId) ?? null,
    upsertStrategy: async (tenantId: string, payload: SeoStrategyPayload) => {
      const next = {
        ...payload,
        tenantId,
        revision: (store.get(tenantId)?.revision ?? 0) + 1,
      };
      store.set(tenantId, next);
      return next;
    },
  };

  const empty = await json(await handleSeoStrategyGet("tenant-1", deps));
  assert.equal((empty.seoStrategy as SeoStrategyRecord).tenantId, "tenant-1");

  const patched = await handleSeoStrategyPatch(
    "tenant-1",
    {
      targetKeywords: [{ keyword: "service pricing", priority: "high" }],
      priorityServices: [],
      priorityLocations: [],
      targetAudiences: [],
      approvedInternalUrls: [],
      preferredCtas: [],
      avoidTopics: ["unsupported topics"],
      avoidClaims: [],
      avoidKeywords: [],
    },
    deps,
  );

  assert.equal(patched.status, 200);
  const body = await json(patched);
  const saved = body.seoStrategy as SeoStrategyRecord;
  assert.equal(saved.revision, 1);
  assert.equal(saved.targetKeywords[0].keyword, "service pricing");
  assert.equal(store.get("tenant-1")?.avoidTopics[0], "unsupported topics");
});

test("SEO strategy handler rejects invalid shapes", async () => {
  const response = await handleSeoStrategyPatch(
    "tenant-1",
    { targetKeywords: [{ keyword: "", priority: "urgent" }] },
    {
      getStrategy: async () => null,
      upsertStrategy: async () => {
        throw new Error("should not write");
      },
    },
  );

  assert.equal(response.status, 400);
});
