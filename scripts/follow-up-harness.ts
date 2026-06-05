#!/usr/bin/env node

/**
 * Follow-up tuning harness (CON-168, Epic C4).
 *
 * Pure dev tooling. Regression-tests the deterministic rule evaluator
 * (`resolveAction` — CON-166) against a corpus of fixture JSON files.
 *
 * Default (mocked) mode replays each fixture's `mock_classifier_output`
 * through the resolver. No OpenAI calls. CI-safe.
 *
 * Live mode (`--live`) calls the actual classifier (`classifyConversation`
 * — CON-165) for each fixture's messages, then runs the result through the
 * resolver. Slow, costs OpenAI tokens. Use to catch classifier-prompt
 * regressions only.
 *
 * Exit code is non-zero on any fixture failure so the harness can drive CI.
 *
 *   npx tsx scripts/follow-up-harness.ts
 *   npx tsx scripts/follow-up-harness.ts --tenant doggo
 *   npx tsx scripts/follow-up-harness.ts --filter "lead-01"
 *   npx tsx scripts/follow-up-harness.ts --verbose
 *   npx tsx scripts/follow-up-harness.ts --live --filter "doggo-lead-01"
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import {
  classifierOutputSchema,
  type ClassifierOutput,
} from "../src/lib/classifier/schema";
import { followUpSchema } from "../src/lib/forum-config/schema";
import type { FollowUp } from "../src/lib/forum-config/schema";
import { resolveAction } from "../src/lib/follow-up/resolver";
import type {
  ConversationContext,
  ResolvedAction,
} from "../src/lib/follow-up/resolver-types";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const FIXTURE_ROOT = join(REPO_ROOT, "docs", "follow-up-fixtures");
const CONFIG_ROOT = join(REPO_ROOT, "docs", "forum-config-examples");

const TENANTS = ["doggo", "agpages"] as const;
type Tenant = (typeof TENANTS)[number];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface CliArgs {
  live: boolean;
  tenant: Tenant | "all";
  filter: RegExp | null;
  verbose: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    live: false,
    tenant: "all",
    filter: null,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--live") args.live = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--tenant") {
      const v = argv[++i];
      if (v !== "doggo" && v !== "agpages" && v !== "all") {
        throw new Error(`--tenant must be doggo|agpages|all (got ${v})`);
      }
      args.tenant = v;
    } else if (a === "--filter") {
      const v = argv[++i];
      if (!v) throw new Error("--filter requires a value");
      try {
        args.filter = new RegExp(v);
      } catch (err) {
        throw new Error(`--filter is not a valid regex: ${(err as Error).message}`);
      }
    } else if (a === "--help" || a === "-h") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("--")) {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Follow-up tuning harness (CON-168)

Usage: npx tsx scripts/follow-up-harness.ts [options]

Options:
  --live                Call the real classifier (OpenAI). Default = mocked.
  --tenant <name>       Restrict to doggo|agpages|all (default: all).
  --filter <regex>      Only fixtures whose filename or name matches the regex.
  --verbose, -v         Print full ResolvedAction on success.
  --help, -h            Show this help.

Mocked mode is CI-safe. Live mode costs OpenAI tokens — do not put --live in CI.
`);
}

// ---------------------------------------------------------------------------
// Fixture types
// ---------------------------------------------------------------------------

interface FixtureMessage {
  role: "user" | "assistant";
  content: string;
}

interface FixtureExpected {
  action: ResolvedAction["type"];
  case_type?: "lead" | "cx_support" | null;
  rule_id?: string;
  routing_key?: string;
  attributes?: {
    persona?: string;
    intent?: string;
    marketplace_side?: string;
  };
  min_confidence?: number;
}

interface Fixture {
  name: string;
  tenant: Tenant;
  messages: FixtureMessage[];
  page_url?: string;
  qualifying_persona?: Record<string, string>;
  mock_classifier_output: unknown;
  expected: FixtureExpected;
  notes?: string;
  // path for diagnostics
  __file: string;
}

// ---------------------------------------------------------------------------
// Config loading (cached per process)
// ---------------------------------------------------------------------------

const followUpCache = new Map<Tenant, FollowUp>();

function loadFollowUpConfig(tenant: Tenant): FollowUp {
  const cached = followUpCache.get(tenant);
  if (cached) return cached;
  const path = join(CONFIG_ROOT, `${tenant}-follow-up.json`);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const parsed = followUpSchema.parse(raw);
  followUpCache.set(tenant, parsed);
  return parsed;
}

// ---------------------------------------------------------------------------
// Fixture discovery
// ---------------------------------------------------------------------------

function discoverFixtures(args: CliArgs): Fixture[] {
  const tenants: Tenant[] =
    args.tenant === "all" ? [...TENANTS] : [args.tenant as Tenant];
  const out: Fixture[] = [];
  for (const tenant of tenants) {
    const dir = join(FIXTURE_ROOT, tenant);
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      console.warn(`⚠ no fixture directory for tenant ${tenant} (${dir})`);
      continue;
    }
    for (const file of entries) {
      if (!file.endsWith(".json")) continue;
      const full = join(dir, file);
      if (!statSync(full).isFile()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(readFileSync(full, "utf8"));
      } catch (err) {
        throw new Error(`fixture ${full} is not valid JSON: ${(err as Error).message}`);
      }
      const f = parsed as Partial<Fixture>;
      if (!f.name || !f.tenant || !Array.isArray(f.messages) || !f.expected || !f.mock_classifier_output) {
        throw new Error(`fixture ${full} is missing required keys (name, tenant, messages, expected, mock_classifier_output)`);
      }
      if (f.tenant !== tenant) {
        throw new Error(`fixture ${full} declares tenant=${f.tenant} but lives in /${tenant}/`);
      }
      const fixture: Fixture = {
        name: f.name,
        tenant: f.tenant,
        messages: f.messages as FixtureMessage[],
        page_url: f.page_url,
        qualifying_persona: f.qualifying_persona,
        mock_classifier_output: f.mock_classifier_output,
        expected: f.expected as FixtureExpected,
        notes: f.notes,
        __file: full,
      };
      if (args.filter) {
        if (!args.filter.test(basename(full)) && !args.filter.test(fixture.name)) {
          continue;
        }
      }
      out.push(fixture);
    }
  }
  // Stable order: tenant then filename
  out.sort((a, b) => {
    if (a.tenant !== b.tenant) return a.tenant.localeCompare(b.tenant);
    return basename(a.__file).localeCompare(basename(b.__file));
  });
  return out;
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

function diffExpectedVsActual(
  expected: FixtureExpected,
  actual: ResolvedAction,
): string[] {
  const lines: string[] = [];
  if (actual.type !== expected.action) {
    lines.push(`  action: expected "${expected.action}", got "${actual.type}"`);
  }
  // Case type — only present on non-default actions
  if (expected.case_type !== undefined && expected.case_type !== null) {
    if (!("case_type" in actual)) {
      lines.push(`  case_type: expected "${expected.case_type}", got <none> (default action)`);
    } else if (actual.case_type !== expected.case_type) {
      lines.push(`  case_type: expected "${expected.case_type}", got "${actual.case_type}"`);
    }
  }
  if (expected.rule_id !== undefined) {
    const got = "rule_id" in actual ? actual.rule_id : null;
    if (got !== expected.rule_id) {
      lines.push(`  rule_id: expected "${expected.rule_id}", got ${got ? `"${got}"` : "<none>"}`);
    }
  }
  if (expected.routing_key !== undefined) {
    const got = "routing_key" in actual ? actual.routing_key : null;
    if (got !== expected.routing_key) {
      lines.push(`  routing_key: expected "${expected.routing_key}", got ${got ? `"${got}"` : "<none>"}`);
    }
  }
  if (expected.attributes) {
    if (!("evidence" in actual)) {
      lines.push(`  attributes: expected ${JSON.stringify(expected.attributes)}, got <none> (default action)`);
    } else {
      const matched = actual.evidence.matched_attributes;
      for (const [k, v] of Object.entries(expected.attributes)) {
        if (matched[k] !== v) {
          lines.push(`  attributes.${k}: expected "${v}", got ${matched[k] ? `"${matched[k]}"` : "<none>"}`);
        }
      }
    }
  }
  if (expected.min_confidence !== undefined) {
    if (!("confidence" in actual)) {
      lines.push(`  min_confidence: expected ≥ ${expected.min_confidence}, got <none> (default action)`);
    } else if (actual.confidence < expected.min_confidence) {
      lines.push(`  min_confidence: expected ≥ ${expected.min_confidence}, got ${actual.confidence}`);
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Single-fixture execution
// ---------------------------------------------------------------------------

interface FixtureResult {
  fixture: Fixture;
  ok: boolean;
  actual: ResolvedAction;
  classifierOutput: ClassifierOutput;
  diffLines: string[];
  error?: string;
  liveClassifierOk?: boolean;
  liveDegradedReason?: string;
}

async function runFixtureMocked(fixture: Fixture): Promise<FixtureResult> {
  let classifierOutput: ClassifierOutput;
  try {
    classifierOutput = classifierOutputSchema.parse(fixture.mock_classifier_output);
  } catch (err) {
    return {
      fixture,
      ok: false,
      actual: { type: "continue_helping" },
      classifierOutput: {} as ClassifierOutput,
      diffLines: [],
      error: `mock_classifier_output failed schema validation: ${(err as Error).message}`,
    };
  }
  const config = loadFollowUpConfig(fixture.tenant);
  const context: ConversationContext = {
    tenantId: fixture.tenant,
    conversationId: `harness:${basename(fixture.__file)}`,
    pageUrl: fixture.page_url,
    qualifyingPersona: fixture.qualifying_persona,
  };
  const actual = resolveAction({
    classifierOutput,
    followUpConfig: config,
    conversationContext: context,
  });
  const diffLines = diffExpectedVsActual(fixture.expected, actual);
  return {
    fixture,
    ok: diffLines.length === 0,
    actual,
    classifierOutput,
    diffLines,
  };
}

async function runFixtureLive(fixture: Fixture): Promise<FixtureResult> {
  // Lazy import so mocked mode never imports openai or hits getOpenAI()
  const { classifyConversation } = await import("../src/lib/classifier");
  const { DEFAULT_FORUM_CONFIG } = await import("../src/lib/forum-config/defaults");

  const tenantConfig = {
    ai_persona: DEFAULT_FORUM_CONFIG.ai_persona,
    qualifying_questions: DEFAULT_FORUM_CONFIG.qualifying_questions,
    allowed_topics: DEFAULT_FORUM_CONFIG.allowed_topics,
  };

  const result = await classifyConversation({
    tenantId: fixture.tenant,
    conversationId: `harness-live:${basename(fixture.__file)}`,
    messages: fixture.messages,
    tenantConfig,
  });

  const config = loadFollowUpConfig(fixture.tenant);
  const context: ConversationContext = {
    tenantId: fixture.tenant,
    conversationId: `harness-live:${basename(fixture.__file)}`,
    pageUrl: fixture.page_url,
    qualifyingPersona: fixture.qualifying_persona,
  };
  const actual = resolveAction({
    classifierOutput: result.output,
    followUpConfig: config,
    conversationContext: context,
  });

  // Live mode: only assert action TYPE matches (model variation tolerated).
  // The harness still records the full diff in `diffLines` for visibility,
  // but `ok` is decided on action.type alone.
  const diffLines = diffExpectedVsActual(fixture.expected, actual);
  const ok = actual.type === fixture.expected.action;
  return {
    fixture,
    ok,
    actual,
    classifierOutput: result.output,
    diffLines,
    liveClassifierOk: result.ok,
    liveDegradedReason: result.degradedReason,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.live ? "LIVE (OpenAI)" : "mocked";
  console.log(`\n🔎 Follow-up tuning harness — mode: ${mode}`);
  if (args.tenant !== "all") console.log(`   tenant filter: ${args.tenant}`);
  if (args.filter) console.log(`   regex filter:  ${args.filter}`);
  console.log("");

  const fixtures = discoverFixtures(args);
  if (fixtures.length === 0) {
    console.error("✗ no fixtures matched");
    process.exit(2);
  }

  const results: FixtureResult[] = [];
  for (const fixture of fixtures) {
    const result = args.live
      ? await runFixtureLive(fixture)
      : await runFixtureMocked(fixture);
    results.push(result);
    const tag = `[${fixture.tenant}] ${basename(fixture.__file)}`;
    if (result.ok) {
      console.log(`✓ ${tag} — ${fixture.name}`);
      if (args.verbose) {
        console.log(`    action: ${result.actual.type}`);
        if ("rule_id" in result.actual) {
          console.log(`    rule:   ${result.actual.rule_id} (routing=${result.actual.routing_key}, conf=${result.actual.confidence.toFixed(2)})`);
        }
        if (args.live) {
          console.log(`    live:   classifier ok=${result.liveClassifierOk}${result.liveDegradedReason ? ` reason=${result.liveDegradedReason}` : ""}`);
        }
      }
    } else {
      console.log(`✗ ${tag} — ${fixture.name}`);
      if (result.error) {
        console.log(`    error: ${result.error}`);
      } else {
        console.log("    diff:");
        for (const line of result.diffLines) console.log(line);
        if (args.verbose) {
          console.log("    actual:");
          console.log("      " + JSON.stringify(result.actual, null, 2).split("\n").join("\n      "));
          if (args.live) {
            console.log("    classifier_output:");
            console.log("      " + JSON.stringify(result.classifierOutput, null, 2).split("\n").join("\n      "));
          }
        }
      }
    }
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;

  console.log("");
  console.log("─".repeat(60));
  // Per-tenant breakdown
  for (const t of TENANTS) {
    const tResults = results.filter((r) => r.fixture.tenant === t);
    if (tResults.length === 0) continue;
    const p = tResults.filter((r) => r.ok).length;
    console.log(`  ${t.padEnd(8)}  ${p}/${tResults.length} passed`);
  }
  console.log("─".repeat(60));
  console.log(`  TOTAL    ${passed}/${results.length} passed${failed ? `  (${failed} failed)` : ""}`);
  console.log("");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ harness aborted:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(2);
});
