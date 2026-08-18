import { test } from "node:test";
import assert from "node:assert/strict";

import { handleBrandSettingsPost } from "../handler";

test("brand settings save preserves unrelated settings keys", async () => {
  const currentSettings = {
    cms: { type: "wordpress" },
    forumConfig: { allowed_topics: ["dog grooming"] },
    brandJson: {
      id: "doggo",
      fonts: { body: "Inter" },
      site: { baseUrl: "https://doggo.com.au" },
    },
  };
  let savedSettings: Record<string, unknown> = {};

  const response = await handleBrandSettingsPost(
    "tenant-1",
    {
      siteName: "Doggo",
      logoUrl: "https://doggo.com.au/logo.png",
      logoAlt: "Doggo logo",
      primaryColor: "#22c55e",
    },
    {
      getTenant: async () => ({
        id: "tenant-1",
        name: "Doggo",
        slug: "doggo",
        domain: "doggo.com.au",
        settings: currentSettings,
      }),
      saveTenantSettings: async (_, settings) => {
        savedSettings = settings;
        return settings;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(savedSettings?.cms, currentSettings.cms);
  assert.deepEqual(savedSettings?.forumConfig, currentSettings.forumConfig);
  assert.deepEqual(
    (savedSettings?.brandJson as Record<string, unknown>).fonts,
    currentSettings.brandJson.fonts,
  );
  assert.deepEqual(
    (savedSettings?.brandJson as Record<string, unknown>).logo,
    {
      url: "https://doggo.com.au/logo.png",
      alt: "Doggo logo",
      height: 30,
    },
  );
});

test("brand settings rejects non-HTTPS logo URLs", async () => {
  const response = await handleBrandSettingsPost(
    "tenant-1",
    {
      siteName: "Doggo",
      logoUrl: "http://doggo.com.au/logo.png",
      logoAlt: "Doggo logo",
      primaryColor: "#22c55e",
    },
    {
      getTenant: async () => ({
        id: "tenant-1",
        name: "Doggo",
        slug: "doggo",
        domain: "doggo.com.au",
        settings: {},
      }),
      saveTenantSettings: async () => {
        throw new Error("should not save");
      },
    },
  );

  assert.equal(response.status, 400);
});
