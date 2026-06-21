import * as esbuild from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile, stat } from "fs/promises";
import { gzipSync } from "zlib";
import CleanCSS from "clean-css";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENTRY = resolve(ROOT, "src/widget/index.ts");
const OUTFILE = resolve(ROOT, "public/widget.js");

// ---------------------------------------------------------------------------
// Widget size budget (raw minified bytes / gzipped bytes for public/widget.js).
// Single source of truth. The CI size-gate workflow (.github/workflows/
// widget-size.yml) re-runs this build and asserts these thresholds. Bump
// deliberately, with sign-off — drift is what got us to 31 KB unnoticed.
//
// Bump history:
//   - 27 KiB raw / 8 KiB gzip — set by CON-176 (post CSS minify pipeline).
//   - 40 KiB raw / 11 KiB gzip — CON-170 D2b (progressive contact capture).
//     New `src/widget/capture.ts` module + field-by-field state machine +
//     ~30 new CSS rules (privacy notice, input row, breadcrumb trail,
//     decline/skip actions). CSS already deduped against the offer card
//     (shared `.convo-card` base + button surface). ~10 KiB raw / ~2.5 KiB
//     gzip net add. Held off SVG-attribute teardown / more aggressive CSS
//     dedup — keep them in reserve for the next feature push (CON-177+).
// ---------------------------------------------------------------------------
export const SIZE_BUDGET = {
  rawBytes: 40 * 1024, // 40 KiB raw minified
  gzipBytes: 11 * 1024, // 11 KiB gzipped
};

// ---------------------------------------------------------------------------
// CSS template-literal minifier (esbuild plugin)
//
// esbuild's `minify:true` does NOT minify CSS inside template literals. The
// widget ships ~12 KB of CSS via getStyles() in src/widget/index.ts as one
// big template literal — newlines, indentation, and comments intact. This
// plugin reads the entry source, locates the getStyles() return template,
// substitutes ${...} interpolations with stable sentinels, runs clean-css
// L2 over the result, and swaps the original interpolations back in before
// esbuild sees the source. Deterministic, no behavioural change.
// ---------------------------------------------------------------------------
function cssTemplateMinifyPlugin() {
  return {
    name: "css-template-minify",
    setup(build) {
      build.onLoad({ filter: /widget\/index\.ts$/ }, async (args) => {
        const original = await readFile(args.path, "utf8");
        const transformed = minifyGetStylesTemplate(original);
        return { contents: transformed, loader: "ts" };
      });
    },
  };
}

function minifyGetStylesTemplate(source) {
  // Match: `return \`` ... matching closing backtick + `;` inside getStyles().
  // getStyles is a top-level function returning a single template literal.
  const fnStart = source.indexOf("function getStyles(");
  if (fnStart === -1) return source;

  const returnIdx = source.indexOf("return `", fnStart);
  if (returnIdx === -1) return source;
  const tplStart = returnIdx + "return `".length;

  // Find the closing backtick of this template literal. Template literals
  // can't contain unescaped backticks in CSS, so the first ` after tplStart
  // (that isn't preceded by a backslash) closes it.
  let tplEnd = -1;
  for (let i = tplStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "`") {
      tplEnd = i;
      break;
    }
  }
  if (tplEnd === -1) return source;

  const templateBody = source.slice(tplStart, tplEnd);

  // Substitute ${...} interpolations with context-aware sentinels so
  // clean-css can parse. Two contexts:
  //   value-position  (after a `:` inside a declaration)  -> bare identifier
  //   decl-position   (standalone, e.g. `${pos}` = `right: 16px;`) -> full
  //                    sentinel declaration so clean-css preserves it.
  const interpolations = [];
  let sentinelIdx = 0;
  // Use a `var(--…)` reference so the sentinel is a syntactically valid CSS
  // value in every position (background, border, color, etc). clean-css L2
  // otherwise drops bare identifiers in `background:`-style decls.
  const valueSentinel = (n) => `var(--__cv${n})`;
  const declSentinelProp = (n) => `--__convo-decl-${n}`;

  let withSentinels = "";
  let cursor = 0;
  const re = /\$\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(templateBody)) !== null) {
    const before = templateBody.slice(cursor, m.index);
    withSentinels += before;

    // Look back through whitespace for the previous non-whitespace char.
    let prev = "";
    for (let i = withSentinels.length - 1; i >= 0; i--) {
      const c = withSentinels[i];
      if (c === " " || c === "\n" || c === "\t" || c === "\r") continue;
      prev = c;
      break;
    }
    const isDeclPosition = prev === ";" || prev === "{" || prev === "}" || prev === "";
    const n = sentinelIdx++;
    if (isDeclPosition) {
      // Wrap as a fake declaration clean-css will preserve.
      const sentinelDecl = `${declSentinelProp(n)}: 0;`;
      interpolations.push({ kind: "decl", sentinel: sentinelDecl, expr: m[1] });
      withSentinels += sentinelDecl;
    } else {
      const s = valueSentinel(n);
      interpolations.push({ kind: "value", sentinel: s, expr: m[1] });
      withSentinels += s;
    }
    cursor = m.index + m[0].length;
  }
  withSentinels += templateBody.slice(cursor);

  const result = new CleanCSS({
    level: 2,
    returnPromise: false,
    compatibility: "*",
  }).minify(withSentinels);

  if (result.errors && result.errors.length) {
    console.error("[widget] clean-css errors:", result.errors);
    throw new Error("clean-css failed to minify widget CSS template");
  }

  // Restore interpolations. Replace each sentinel back. clean-css preserves
  // them as opaque tokens at value positions.
  let minified = result.styles;
  for (const interp of interpolations) {
    if (interp.kind === "value") {
      if (!minified.includes(interp.sentinel)) {
        console.warn(
          `[widget] value sentinel ${interp.sentinel} missing post-minify — falling back to unminified CSS for safety`
        );
        return source;
      }
      // clean-css inserts a space between `var(…)` and an adjacent unit
      // (e.g. `var(--__cv1)px` -> `var(--__cv1) px`). After swap-back that
      // would emit `${expr} px` (invalid CSS). Strip the inserted space
      // when the sentinel is directly followed by a CSS unit.
      const reUnit = new RegExp(
        interp.sentinel.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") +
          "(\\s+)(px|em|rem|%|vh|vw|vmin|vmax|deg|rad|turn|ms|s|fr|ch|ex|pt|pc|in|cm|mm)(?![a-zA-Z])"
      );
      if (reUnit.test(minified)) {
        minified = minified.replace(reUnit, `\${${interp.expr}}$2`);
      } else {
        minified = minified.replace(interp.sentinel, `\${${interp.expr}}`);
      }
    } else {
      // Decl sentinel: replace whole declaration (with optional trailing `;`).
      // clean-css may drop the trailing semi on the last decl in a block.
      const propEsc = interp.sentinel.split(":")[0]; // --__convo-decl-N
      const declRe = new RegExp(propEsc.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s*:\\s*0\\s*;?");
      if (!declRe.test(minified)) {
        console.warn(
          `[widget] decl sentinel ${propEsc} missing post-minify — falling back to unminified CSS for safety`
        );
        return source;
      }
      minified = minified.replace(declRe, `\${${interp.expr}}`);
    }
  }

  return source.slice(0, tplStart) + minified + source.slice(tplEnd);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------
await esbuild.build({
  entryPoints: [ENTRY],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: OUTFILE,
  sourcemap: false,
  logLevel: "info",
  plugins: [cssTemplateMinifyPlugin()],
});

// ---------------------------------------------------------------------------
// Size report + budget enforcement
// ---------------------------------------------------------------------------
const buf = await readFile(OUTFILE);
const rawBytes = buf.byteLength;
const gzipBytes = gzipSync(buf, { level: 9 }).byteLength;

const fmt = (n) => `${n.toLocaleString()} B (${(n / 1024).toFixed(2)} KiB)`;
console.log(`[widget] raw  = ${fmt(rawBytes)}  / budget ${fmt(SIZE_BUDGET.rawBytes)}`);
console.log(`[widget] gzip = ${fmt(gzipBytes)} / budget ${fmt(SIZE_BUDGET.gzipBytes)}`);

const overRaw = rawBytes > SIZE_BUDGET.rawBytes;
const overGzip = gzipBytes > SIZE_BUDGET.gzipBytes;

// CI gate: opt-in via env var so local dev builds don't hard-fail mid-iteration.
// CI sets CONVO_WIDGET_SIZE_GATE=1.
if (process.env.CONVO_WIDGET_SIZE_GATE === "1" && (overRaw || overGzip)) {
  console.error(
    `[widget] SIZE BUDGET EXCEEDED. raw over=${overRaw} gzip over=${overGzip}. ` +
      `Reduce widget bundle OR bump SIZE_BUDGET in scripts/build-widget.mjs with sign-off.`
  );
  process.exit(1);
} else if (overRaw || overGzip) {
  console.warn(
    `[widget] WARNING: budget exceeded locally (raw over=${overRaw} gzip over=${overGzip}). ` +
      `CI will fail until reduced or budget bumped.`
  );
}
