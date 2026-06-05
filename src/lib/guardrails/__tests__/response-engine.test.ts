/**
 * CON-90 unit tests — response-engine helpers.
 *
 * Self-contained tsx-runnable script (no Jest/Vitest in this repo, by
 * design). Matches the CON-98 test pattern (`src/lib/guardrails/__tests__/
 * injection.test.ts`). Run with:
 *
 *     npx tsx src/lib/guardrails/__tests__/response-engine.test.ts
 *
 * Exits non-zero on any failure. CI-friendly.
 *
 * Coverage:
 *   - Banned-word filter: one-shot + streaming (tail-buffer) paths.
 *   - Word-boundary semantics (whole-word, multi-word phrase, no substr).
 *   - Case-insensitivity.
 *   - Empty/missing term lists are no-ops.
 *   - resolveResponseEngine: forum config resolution, flag defaults
 *     (all ON), token cap, addendum content.
 *   - Feature flags default ON; explicit false disables.
 */

import {
  buildBannedRegex,
  collectBannedTerms,
  createStreamingFilter,
  filterText,
  REDACTION,
} from "../banned-words";
import {
  buildResponseEngineAddendum,
  resolveForumConfig,
  resolveMaxTokens,
  resolveResponseEngine,
} from "../response-engine";
import { DEFAULT_FORUM_CONFIG } from "@/lib/forum-config/defaults";

interface Failure {
  name: string;
  detail: string;
}

const failures: Failure[] = [];

function check(name: string, cond: boolean, detail: string) {
  if (!cond) failures.push({ name, detail });
}

function eq<T>(name: string, got: T, want: T) {
  check(
    name,
    JSON.stringify(got) === JSON.stringify(want),
    `expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
  );
}

// ─── collectBannedTerms ──────────────────────────────────────

eq(
  "collectBannedTerms: merges + dedupes + trims",
  collectBannedTerms(["foo", " bar ", "", "foo"], ["bar", "baz"]).sort(),
  ["bar", "baz", "foo"].sort(),
);

eq(
  "collectBannedTerms: undefined inputs",
  collectBannedTerms(undefined, undefined),
  [],
);

// ─── buildBannedRegex ────────────────────────────────────────

check(
  "buildBannedRegex: returns null on empty list",
  buildBannedRegex([]) === null,
  "expected null",
);

const r = buildBannedRegex(["foo", "medical advice"]);
check(
  "buildBannedRegex: matches whole word case-insensitive",
  !!r && "I want some FOO please".match(r) !== null,
  "expected match on FOO",
);
check(
  "buildBannedRegex: does NOT match substring",
  !!r && "foolish question".match(r!) === null,
  "expected no match on foolish",
);
check(
  "buildBannedRegex: matches multi-word phrase",
  !!r && "please give me medical advice now".match(r!) !== null,
  "expected match on multi-word phrase",
);

// ─── filterText (one-shot) ──────────────────────────────────

{
  const { output, redactionCount } = filterText(
    "You should consult medical advice from a doctor — definitely not FOO.",
    ["foo", "medical advice"],
  );
  eq(
    "filterText: redacts both terms",
    output,
    `You should consult ${REDACTION} from a doctor — definitely not ${REDACTION}.`,
  );
  eq("filterText: redaction count", redactionCount, 2);
}

{
  const { output, redactionCount } = filterText(
    "Nothing banned in here at all.",
    ["foo", "bar"],
  );
  eq("filterText: clean text passthrough", output, "Nothing banned in here at all.");
  eq("filterText: redaction count 0", redactionCount, 0);
}

{
  // Word boundaries — "advice" is NOT in the banned list, only the
  // full phrase "medical advice" is. "medical" alone should also miss.
  const { output, redactionCount } = filterText(
    "Some general advice on a medical question.",
    ["medical advice"],
  );
  eq("filterText: phrase respects boundaries", output, "Some general advice on a medical question.");
  eq("filterText: no false positive", redactionCount, 0);
}

{
  // Empty list: passthrough.
  const { output, redactionCount } = filterText("Anything goes.", []);
  eq("filterText: empty list passthrough", output, "Anything goes.");
  eq("filterText: empty list count 0", redactionCount, 0);
}

{
  // Overlap: longer phrase should win, not get partially eaten by the
  // shorter word.
  const { output } = filterText(
    "give me medical advice please",
    ["medical", "medical advice"],
  );
  eq(
    "filterText: longest-match wins on overlapping terms",
    output,
    `give me ${REDACTION} please`,
  );
}

// ─── createStreamingFilter ───────────────────────────────────

{
  // Passthrough when no terms.
  const f = createStreamingFilter([]);
  let out = "";
  out += f.push("hello ");
  out += f.push("world");
  out += f.flush();
  eq("streamingFilter: passthrough", out, "hello world");
  eq("streamingFilter: passthrough count 0", f.redactionCount(), 0);
}

{
  // Banned term split across chunk boundary — must NOT leak the prefix.
  const f = createStreamingFilter(["medical advice"]);
  let out = "";
  // Chunk that contains the START of "medical advice"
  out += f.push("You should seek medic");
  // The tail is buffered, so the first push must not contain "medic"
  check(
    "streamingFilter: holds tail across boundary (no leak)",
    !out.includes("medic"),
    `unexpected leak in early output: ${JSON.stringify(out)}`,
  );
  out += f.push("al advice from a doctor");
  out += f.flush();
  eq(
    "streamingFilter: redacts across chunk boundary",
    out,
    `You should seek ${REDACTION} from a doctor`,
  );
  eq("streamingFilter: redaction count 1", f.redactionCount(), 1);
}

{
  // Many small chunks (token-by-token) — should reassemble + redact.
  const f = createStreamingFilter(["sausage"]);
  const tokens = ["I love ", "saus", "age ", "rolls today"];
  let out = "";
  for (const t of tokens) out += f.push(t);
  out += f.flush();
  eq(
    "streamingFilter: redacts term split across many tiny chunks",
    out,
    `I love ${REDACTION} rolls today`,
  );
}

{
  // Long clean stream — output should equal input, byte-for-byte.
  const f = createStreamingFilter(["nope"]);
  const text =
    "The Convo response engine is a thin layer over OpenAI that ".repeat(20);
  let out = "";
  for (let i = 0; i < text.length; i += 7) out += f.push(text.slice(i, i + 7));
  out += f.flush();
  eq("streamingFilter: clean stream identity", out, text);
}

// ─── Regression: CON-90 PR #16 buffer-flush bug ──────────────
//
// Surface: live smoke against Doggo (default exclusion_list active)
// returned an orphan-prefix sentence — "...vet visits. your home by
// puppy-proofing..." — suggesting the tail buffer was dropping a
// leading verb across a paragraph boundary. Root cause turned out to
// be the safe/tail cut point only recognising ASCII space; when the
// safe region contained newlines (paragraph breaks) but no spaces,
// the boundary couldn't advance and content stayed buffered. These
// tests lock in the fix.

{
  // Test A — empty banned-words list: stream tokens including a
  // sentence boundary; every token must arrive byte-identical.
  const f = createStreamingFilter([]);
  const tokens = ["Hello", " world.", " Preparing", " your", " home."];
  let out = "";
  for (const t of tokens) out += f.push(t);
  out += f.flush();
  eq("regression A: empty list streams identically", out, tokens.join(""));
  eq("regression A: redaction count 0", f.redactionCount(), 0);
}

{
  // Test B — banned list does NOT contain any of the streamed words.
  // Mirrors the live smoke failure shape: leading verb ("Consider")
  // must not be eaten even though the filter is active.
  const f = createStreamingFilter(["badword"]);
  const tokens = ["Consider", " your", " home", " by", " preparing"];
  let out = "";
  for (const t of tokens) out += f.push(t);
  out += f.flush();
  eq("regression B: non-matching stream preserved verbatim", out, tokens.join(""));
  eq("regression B: redaction count 0", f.redactionCount(), 0);
}

{
  // Test C — banned term is present and surrounded by non-banned
  // text: banned term is redacted, every other token survives intact.
  const f = createStreamingFilter(["badword"]);
  const tokens = ["this", " is", " a", " badword", " test"];
  let out = "";
  for (const t of tokens) out += f.push(t);
  out += f.flush();
  eq(
    "regression C: banned term redacted, rest intact",
    out,
    `this is a ${REDACTION} test`,
  );
  eq("regression C: redaction count 1", f.redactionCount(), 1);
}

{
  // Test D — newline-only whitespace: previously the safe/tail cut
  // point only recognised ASCII space, so a stream punctuated only by
  // `\n` would buffer indefinitely. Stream must arrive verbatim and
  // should NOT all be deferred to flush().
  const f = createStreamingFilter(["badword"]);
  // Long enough to force a buffer flush mid-stream (tailSize = 7 + 8 = 15).
  const chunks = [
    "first-line-here\n",
    "second-line-here\n",
    "third-line-here\n",
    "fourth-line-here\n",
    "fifth-line-here",
  ];
  let mid = "";
  for (const c of chunks) mid += f.push(c);
  const tail = f.flush();
  eq(
    "regression D: newline-separated stream survives intact",
    mid + tail,
    chunks.join(""),
  );
  check(
    "regression D: emitted progressively (not all deferred to flush)",
    mid.length > 0,
    `expected progressive emission, got mid=${JSON.stringify(mid)}`,
  );
}

{
  // Test E — paragraph-break shape from the live smoke: chunk
  // contains a leading space + `\n\n` + the new sentence's first
  // token. The leading verb of the new sentence must survive.
  const f = createStreamingFilter([
    "medical advice",
    "legal advice",
    "financial advice",
    "regulated advice",
  ]);
  const chunks = [
    "food and vet visits.",
    " \n\nPreparing",
    " your home",
    " by puppy-proofing",
    " and gathering necessary",
    " supplies is also essential.",
  ];
  let out = "";
  for (const c of chunks) out += f.push(c);
  out += f.flush();
  eq(
    "regression E: paragraph-break preserves leading verb",
    out,
    chunks.join(""),
  );
  eq("regression E: no false-positive redactions", f.redactionCount(), 0);
}

{
  // Test F — defensive guard: empty-string entries in the terms list
  // must NOT produce an everything-matches regex.
  const f = createStreamingFilter(["", "   ", "badword"]);
  const chunks = ["perfectly", " fine", " text", " here"];
  let out = "";
  for (const c of chunks) out += f.push(c);
  out += f.flush();
  eq("regression F: empty terms ignored, text preserved", out, chunks.join(""));
  eq("regression F: no spurious redactions", f.redactionCount(), 0);
}

// ─── resolveForumConfig ──────────────────────────────────────

eq(
  "resolveForumConfig: null settings → defaults",
  resolveForumConfig(null),
  DEFAULT_FORUM_CONFIG,
);

eq(
  "resolveForumConfig: missing forumConfig key → defaults",
  resolveForumConfig({ otherStuff: true }),
  DEFAULT_FORUM_CONFIG,
);

{
  // Garbage forumConfig → safeParse falls back to defaults (parseForumConfigSafe contract).
  const got = resolveForumConfig({ forumConfig: { schema_version: "not a number" } });
  eq("resolveForumConfig: invalid → defaults", got, DEFAULT_FORUM_CONFIG);
}

{
  // Valid override of just the limits block.
  const got = resolveForumConfig({
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      limits: { ...DEFAULT_FORUM_CONFIG.limits, max_output_tokens: 500 },
    },
  });
  eq("resolveForumConfig: limits override accepted", got.limits.max_output_tokens, 500);
}

// ─── resolveMaxTokens ────────────────────────────────────────

eq(
  "resolveMaxTokens: enforced uses config",
  resolveMaxTokens(DEFAULT_FORUM_CONFIG, {
    threePartStructure: true,
    bannedWordFilter: true,
    enforceTokenCap: true,
    applyLocale: true,
  }),
  DEFAULT_FORUM_CONFIG.limits.max_output_tokens,
);

eq(
  "resolveMaxTokens: disabled returns undefined",
  resolveMaxTokens(DEFAULT_FORUM_CONFIG, {
    threePartStructure: true,
    bannedWordFilter: true,
    enforceTokenCap: false,
    applyLocale: true,
  }),
  undefined,
);

// ─── buildResponseEngineAddendum ─────────────────────────────

{
  const addendum = buildResponseEngineAddendum({
    forumConfig: DEFAULT_FORUM_CONFIG,
    flags: {
      threePartStructure: true,
      bannedWordFilter: true,
      enforceTokenCap: true,
      applyLocale: true,
    },
  });
  check(
    "addendum: contains 3-part structure rule",
    addendum.includes("Direct answer") && addendum.includes("Practical next step"),
    `missing 3-part block in: ${addendum.slice(0, 200)}`,
  );
  check(
    "addendum: contains AU English locale instruction",
    addendum.includes("Australian English"),
    "missing AU locale instruction",
  );
}

{
  const addendum = buildResponseEngineAddendum({
    forumConfig: DEFAULT_FORUM_CONFIG,
    flags: {
      threePartStructure: false,
      bannedWordFilter: false,
      enforceTokenCap: false,
      applyLocale: false,
    },
  });
  eq("addendum: all flags off → empty string", addendum, "");
}

// ─── resolveResponseEngine ───────────────────────────────────

{
  const resolved = resolveResponseEngine(null);
  eq(
    "resolveResponseEngine: defaults — token cap = 1500",
    resolved.maxTokens,
    1500,
  );
  check(
    "resolveResponseEngine: defaults — addendum non-empty",
    resolved.promptAddendum.length > 0,
    "expected non-empty addendum",
  );
  eq(
    "resolveResponseEngine: defaults — banned terms from exclusion_list",
    resolved.bannedTerms.sort(),
    ["legal advice", "medical advice", "financial advice", "regulated advice"].sort(),
  );
  eq(
    "resolveResponseEngine: flags default ON",
    resolved.flags,
    {
      threePartStructure: true,
      bannedWordFilter: true,
      enforceTokenCap: true,
      applyLocale: true,
    },
  );
}

{
  // Explicit opt-out via settings.responseEngine.
  const resolved = resolveResponseEngine({
    responseEngine: {
      threePartStructure: false,
      bannedWordFilter: false,
      enforceTokenCap: false,
      applyLocale: false,
    },
  });
  eq(
    "resolveResponseEngine: opt-out — addendum empty",
    resolved.promptAddendum,
    "",
  );
  eq(
    "resolveResponseEngine: opt-out — no banned terms",
    resolved.bannedTerms,
    [],
  );
  eq(
    "resolveResponseEngine: opt-out — no token cap",
    resolved.maxTokens,
    undefined,
  );
}

{
  // Merging banned_words + exclusion_list, deduped.
  const resolved = resolveResponseEngine({
    forumConfig: {
      ...DEFAULT_FORUM_CONFIG,
      ai_persona: {
        ...DEFAULT_FORUM_CONFIG.ai_persona,
        banned_words: ["competitor", "medical advice"],
      },
    },
  });
  check(
    "resolveResponseEngine: merges + dedupes banned terms",
    resolved.bannedTerms.includes("competitor") &&
      resolved.bannedTerms.includes("medical advice") &&
      resolved.bannedTerms.filter((t) => t === "medical advice").length === 1,
    `unexpected merged terms: ${JSON.stringify(resolved.bannedTerms)}`,
  );
}

// ─── Report ──────────────────────────────────────────────────

if (failures.length === 0) {
  console.log("CON-90 response-engine: ALL TESTS PASSED");
  process.exit(0);
} else {
  console.error(`CON-90 response-engine: ${failures.length} FAILURE(S)`);
  for (const f of failures) {
    console.error(`  - ${f.name}: ${f.detail}`);
  }
  process.exit(1);
}
