import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildSeedPlan,
  runSeedTenantForumConfig,
  SeedConfigError,
  validateSeedConfig,
} from "../seed-tenant-forum-config";

const validFourSliceConfig = {
  follow_up: {
    enabled: true,
    contact_methods: [],
    capture_policies: [],
    rules: [],
    destinations: [],
  },
  ai_persona: {
    tone: "friendly",
    locale: "en-AU",
    banned_words: [],
    voice_description: "Clear, practical and calm.",
  },
  qualifying_questions: {
    additional: [],
  },
  allowed_topics: ["support", "pricing"],
};

test("merge preserves existing settings and non-target forumConfig keys", () => {
  const plan = buildSeedPlan(
    {
      widget: { primaryColor: "#FF6B2C" },
      forumConfig: {
        welcome: { copy: "Existing welcome" },
        cta_rules: [{ tag: "pricing", text: "Pricing", url: "https://example.com" }],
      },
    },
    validFourSliceConfig,
    { allowOverwrite: false },
  );

  const forumConfig = plan.nextSettings.forumConfig as Record<string, unknown>;
  assert.deepEqual(plan.nextSettings.widget, { primaryColor: "#FF6B2C" });
  assert.deepEqual(forumConfig.welcome, { copy: "Existing welcome" });
  assert.deepEqual(forumConfig.cta_rules, [
    { tag: "pricing", text: "Pricing", url: "https://example.com" },
  ]);
  assert.deepEqual(forumConfig.allowed_topics, ["support", "pricing"]);
});

test("validation rejects invalid four-slice input with structured errors", () => {
  const result = validateSeedConfig({
    ...validFourSliceConfig,
    ai_persona: null,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.error, "Validation failed");
    assert(result.error.issues?.some((issue) => issue.path === "ai_persona"));
  }
});

test("--dry-run returns planned diff without writing", async () => {
  const file = writeFixture(validFourSliceConfig);
  let wrote = false;

  const result = await runSeedTenantForumConfig(
    { tenant: "tenant-a", file, dryRun: true },
    {
      getTenant: async () => ({
        id: "tenant-a",
        slug: "tenant-a",
        settings: { forumConfig: { welcome: { copy: "Keep" } } },
      }),
      saveTenantSettings: async () => {
        wrote = true;
        return {};
      },
      readTenantSettings: async () => {
        throw new Error("dry-run should not verify by re-reading");
      },
      writeSnapshot: async () => {
        throw new Error("dry-run should not write a snapshot");
      },
    },
  );

  assert.equal(result.dryRun, true);
  assert.equal(wrote, false);
  assert.deepEqual(result.writtenSlices, [
    "follow_up",
    "ai_persona",
    "qualifying_questions",
    "allowed_topics",
  ]);
  assert.equal(result.snapshotPath, null);
});

test("without --allow-overwrite, replacing an existing slice errors clearly", () => {
  assert.throws(
    () =>
      buildSeedPlan(
        { forumConfig: { ai_persona: { voice_description: "Existing" } } },
        validFourSliceConfig,
        { allowOverwrite: false },
      ),
    (error) => {
      assert(error instanceof SeedConfigError);
      assert.equal(
        error.details.error,
        "Refusing to overwrite existing forumConfig slices",
      );
      assert.deepEqual(error.details.slices, ["ai_persona"]);
      return true;
    },
  );
});

test("--allow-overwrite replaces existing target slices", () => {
  const plan = buildSeedPlan(
    {
      forumConfig: {
        ai_persona: { voice_description: "Existing" },
        allowed_topics: ["old"],
        welcome: { copy: "Keep" },
      },
    },
    validFourSliceConfig,
    { allowOverwrite: true },
  );

  const forumConfig = plan.nextSettings.forumConfig as Record<string, unknown>;
  assert.deepEqual(forumConfig.ai_persona, validFourSliceConfig.ai_persona);
  assert.deepEqual(forumConfig.allowed_topics, ["support", "pricing"]);
  assert.deepEqual(forumConfig.welcome, { copy: "Keep" });
});

function writeFixture(value: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "forum-config-seed-"));
  const file = join(dir, "forum-config.json");
  writeFileSync(file, JSON.stringify(value), "utf8");
  return file;
}
