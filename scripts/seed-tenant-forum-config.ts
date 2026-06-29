#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { eq, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "../src/lib/db";
import { tenants } from "../src/lib/db/schema";
import {
  forumConfigSchema,
  type ForumConfig,
} from "../src/lib/forum-config/schema";
import {
  REQUIRED_FORUM_CONFIG_SLICES,
  type RequiredForumConfigSlice,
} from "../src/lib/forum-config/completeness";

type JsonObject = Record<string, unknown>;

type TenantRecord = {
  id: string;
  slug: string;
  settings: JsonObject;
};

type SeedDeps = {
  getTenant: (tenant: string) => Promise<TenantRecord | null>;
  saveTenantSettings: (
    tenantId: string,
    settings: JsonObject,
  ) => Promise<JsonObject>;
  readTenantSettings: (tenantId: string) => Promise<JsonObject | null>;
  writeSnapshot: (
    tenantId: string,
    settings: JsonObject,
  ) => Promise<string> | string;
};

type SeedOptions = {
  tenant: string;
  file: string;
  dryRun?: boolean;
  allowOverwrite?: boolean;
};

export type ValidationResult =
  | { ok: true; data: Pick<ForumConfig, RequiredForumConfigSlice> }
  | { ok: false; error: StructuredSeedError };

export type StructuredSeedError = {
  error: string;
  issues?: Array<{ path: string; message: string }>;
  slices?: RequiredForumConfigSlice[];
};

export type SeedPlan = {
  nextSettings: JsonObject;
  writtenSlices: RequiredForumConfigSlice[];
  diff: JsonObject;
};

export async function runSeedTenantForumConfig(
  options: SeedOptions,
  deps: SeedDeps,
) {
  const tenant = await deps.getTenant(options.tenant);
  if (!tenant) {
    throw new SeedConfigError({
      error: "Tenant not found",
      issues: [{ path: "tenant", message: options.tenant }],
    });
  }

  const input = parseJsonFile(options.file);
  const plan = buildSeedPlan(tenant.settings, input, {
    allowOverwrite: !!options.allowOverwrite,
  });

  if (options.dryRun) {
    return {
      tenant,
      dryRun: true,
      snapshotPath: null,
      writtenSlices: plan.writtenSlices,
      diff: plan.diff,
    };
  }

  const snapshotPath = await deps.writeSnapshot(tenant.id, tenant.settings);
  await deps.saveTenantSettings(tenant.id, plan.nextSettings);

  const saved = await deps.readTenantSettings(tenant.id);
  if (!saved) {
    throw new SeedConfigError({
      error: "Verification failed",
      issues: [{ path: "tenant", message: "Tenant disappeared after write" }],
    });
  }
  verifyWrittenSlices(saved, plan.nextSettings, plan.writtenSlices);

  return {
    tenant,
    dryRun: false,
    snapshotPath,
    writtenSlices: plan.writtenSlices,
    diff: plan.diff,
  };
}

export function buildSeedPlan(
  currentSettings: JsonObject,
  input: unknown,
  options: { allowOverwrite: boolean },
): SeedPlan {
  const validation = validateSeedConfig(input);
  if (!validation.ok) {
    throw new SeedConfigError(validation.error);
  }

  const currentForumConfig = isPlainObject(currentSettings.forumConfig)
    ? currentSettings.forumConfig
    : {};
  const overwrites = REQUIRED_FORUM_CONFIG_SLICES.filter((slice) =>
    Object.prototype.hasOwnProperty.call(currentForumConfig, slice),
  );

  if (overwrites.length > 0 && !options.allowOverwrite) {
    throw new SeedConfigError({
      error: "Refusing to overwrite existing forumConfig slices",
      slices: overwrites,
      issues: overwrites.map((slice) => ({
        path: `forumConfig.${slice}`,
        message: "Pass --allow-overwrite to replace this existing slice",
      })),
    });
  }

  const nextForumConfig: JsonObject = { ...currentForumConfig };
  for (const slice of REQUIRED_FORUM_CONFIG_SLICES) {
    nextForumConfig[slice] = validation.data[slice];
  }

  const nextSettings: JsonObject = {
    ...currentSettings,
    forumConfig: nextForumConfig,
  };

  return {
    nextSettings,
    writtenSlices: [...REQUIRED_FORUM_CONFIG_SLICES],
    diff: buildPlannedDiff(currentForumConfig, validation.data),
  };
}

export function validateSeedConfig(input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: {
        error: "Seed file must contain a JSON object",
        issues: [{ path: "", message: "Expected object" }],
      },
    };
  }

  const missing = REQUIRED_FORUM_CONFIG_SLICES.filter(
    (slice) => !Object.prototype.hasOwnProperty.call(input, slice),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        error: "Seed file must include all four required forumConfig slices",
        slices: missing,
        issues: missing.map((slice) => ({
          path: slice,
          message: "Required slice missing",
        })),
      },
    };
  }

  const parsed = forumConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        error: "Validation failed",
        issues: formatZodIssues(parsed.error),
      },
    };
  }

  return {
    ok: true,
    data: {
      follow_up: parsed.data.follow_up,
      ai_persona: parsed.data.ai_persona,
      qualifying_questions: parsed.data.qualifying_questions,
      allowed_topics: parsed.data.allowed_topics,
    },
  };
}

function verifyWrittenSlices(
  savedSettings: JsonObject,
  expectedSettings: JsonObject,
  slices: RequiredForumConfigSlice[],
) {
  const savedForumConfig = isPlainObject(savedSettings.forumConfig)
    ? savedSettings.forumConfig
    : {};
  const expectedForumConfig = isPlainObject(expectedSettings.forumConfig)
    ? expectedSettings.forumConfig
    : {};

  const mismatches = slices.filter(
    (slice) =>
      stableJson(savedForumConfig[slice]) !== stableJson(expectedForumConfig[slice]),
  );

  if (mismatches.length > 0) {
    throw new SeedConfigError({
      error: "Verification failed",
      slices: mismatches,
      issues: mismatches.map((slice) => ({
        path: `forumConfig.${slice}`,
        message: "Stored slice does not byte-match the planned write",
      })),
    });
  }
}

function parseJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch (error) {
    throw new SeedConfigError({
      error: "Could not read seed file",
      issues: [
        {
          path,
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    });
  }
}

function buildPlannedDiff(
  currentForumConfig: JsonObject,
  seedConfig: Pick<ForumConfig, RequiredForumConfigSlice>,
): JsonObject {
  const slices: JsonObject = {};
  for (const slice of REQUIRED_FORUM_CONFIG_SLICES) {
    slices[slice] = {
      before: Object.prototype.hasOwnProperty.call(currentForumConfig, slice)
        ? currentForumConfig[slice]
        : null,
      after: seedConfig[slice],
      changed: !isDeepStrictEqual(currentForumConfig[slice], seedConfig[slice]),
    };
  }
  return { forumConfig: slices };
}

function writeSettingsSnapshot(tenantId: string, settings: JsonObject): string {
  const dir = resolve("tmp/seed-snapshots");
  mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(dir, `${tenantId}-${timestamp}.json`);
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return path;
}

function createDbDeps(): SeedDeps {
  return {
    getTenant: async (tenantArg) => {
      const where = isUuid(tenantArg)
        ? or(eq(tenants.id, tenantArg), eq(tenants.slug, tenantArg))
        : eq(tenants.slug, tenantArg);

      const [tenant] = await db
        .select({
          id: tenants.id,
          slug: tenants.slug,
          settings: tenants.settings,
        })
        .from(tenants)
        .where(where)
        .limit(1);

      if (!tenant) return null;
      return {
        id: tenant.id,
        slug: tenant.slug,
        settings: isPlainObject(tenant.settings) ? tenant.settings : {},
      };
    },
    saveTenantSettings: async (tenantId, settings) => {
      const [updated] = await db
        .update(tenants)
        .set({ settings, updatedAt: new Date() })
        .where(eq(tenants.id, tenantId))
        .returning({ settings: tenants.settings });
      return isPlainObject(updated?.settings) ? updated.settings : {};
    },
    readTenantSettings: async (tenantId) => {
      const [tenant] = await db
        .select({ settings: tenants.settings })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) return null;
      return isPlainObject(tenant.settings) ? tenant.settings : {};
    },
    writeSnapshot: async (tenantId, settings) =>
      writeSettingsSnapshot(tenantId, settings),
  };
}

function parseArgs(argv: string[]): SeedOptions {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "--allow-overwrite") {
      args.set(arg, true);
      continue;
    }
    if (arg === "--tenant" || arg === "--file") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new SeedConfigError({
          error: `Missing value for ${arg}`,
        });
      }
      args.set(arg, value);
      i++;
      continue;
    }
    throw new SeedConfigError({
      error: `Unknown argument ${arg}`,
    });
  }

  const tenantArg = args.get("--tenant");
  const file = args.get("--file");
  if (typeof tenantArg !== "string" || typeof file !== "string") {
    throw new SeedConfigError({
      error:
        "Usage: tsx scripts/seed-tenant-forum-config.ts --tenant <id-or-slug> --file <json> [--dry-run] [--allow-overwrite]",
    });
  }

  return {
    tenant: tenantArg,
    file,
    dryRun: args.has("--dry-run"),
    allowOverwrite: args.has("--allow-overwrite"),
  };
}

function formatZodIssues(error: z.ZodError): StructuredSeedError["issues"] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export class SeedConfigError extends Error {
  readonly details: StructuredSeedError;

  constructor(details: StructuredSeedError) {
    super(details.error);
    this.name = "SeedConfigError";
    this.details = details;
  }
}

async function main() {
  try {
    const result = await runSeedTenantForumConfig(
      parseArgs(process.argv.slice(2)),
      createDbDeps(),
    );

    console.log(
      JSON.stringify(
        {
          event: "forum_config_seed_complete",
          dry_run: result.dryRun,
          tenant_id: result.tenant.id,
          slug: result.tenant.slug,
          snapshot_path: result.snapshotPath,
          written_slices: result.writtenSlices,
          diff: result.diff,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const details =
      error instanceof SeedConfigError
        ? error.details
        : { error: error instanceof Error ? error.message : String(error) };
    console.error(JSON.stringify(details, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
