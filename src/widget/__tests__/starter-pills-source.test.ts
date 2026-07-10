/**
 * CON-253 — starter pills stay on the closed-launcher surface.
 *
 * The widget is bundled as a standalone script, so this source-level test
 * guards the DOM order/z-index contract that keeps starter pills outside
 * the open panel.
 *
 * Run with:
 *   npx tsx --test src/widget/__tests__/starter-pills-source.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const widgetSource = readFileSync(
  join(process.cwd(), "src/widget/index.ts"),
  "utf8",
);

test("starter pills are mounted before the panel and bubble", () => {
  assert.match(
    widgetSource,
    /this\.shadow\.appendChild\(style\);[\s\S]*?this\.renderStarterPills\(\);[\s\S]*?this\.shadow\.appendChild\(this\.panel\);[\s\S]*?this\.shadow\.appendChild\(this\.bubble\);/,
  );
});

test("starter pills stack below the panel and hide while open", () => {
  assert.match(
    widgetSource,
    /\.convo-starter-pills\s*\{[\s\S]*?z-index:\s*2147483645;/,
  );
  assert.match(
    widgetSource,
    /this\.starterPillsEl\.classList\.toggle\("hidden", this\.isOpen\);/,
  );
});
