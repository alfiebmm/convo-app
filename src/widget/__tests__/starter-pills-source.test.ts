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

function sourceBetween(start: string, end: string): string {
  const startIndex = widgetSource.indexOf(start);
  const endIndex = widgetSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `missing source marker: ${end}`);
  return widgetSource.slice(startIndex, endIndex);
}

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

test("starter pill clicks buffer behind qualifying questions", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private p(): boolean {",
  );

  assert.match(
    widgetSource,
    /private pendingPillPrompt: string \| null = null;/,
  );
  assert.match(
    handler,
    /if \(!this\.isOpen\) \{\s*this\.toggle\(\);\s*\}[\s\S]*?if \(this\.nextQualifyingPrompt\(\)\) \{\s*this\.pendingPillPrompt = pill\.prompt;\s*return;\s*\}/,
  );
});

test("starter pill clicks still send immediately with no qualifying prompt", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private p(): boolean {",
  );

  assert.match(
    handler,
    /if \(this\.nextQualifyingPrompt\(\)\) \{[\s\S]*?return;[\s\S]*?\}\s*\/\/ Fire the message through the standard send\(\) pipeline[\s\S]*?this\.inputEl\.value = pill\.prompt;\s*void this\.send\(\);/,
  );
});

test("qualifying completion flushes a buffered pill prompt instead of greeting", () => {
  const flushCount = widgetSource.match(
    /this\.setInputLocked\(false\);\s*if \(this\.p\(\)\) \{\s*return;\s*\}/g,
  )?.length;

  assert.equal(flushCount, 2);
  assert.match(
    widgetSource,
    /private p\(\): boolean \{\s*const prompt = this\.pendingPillPrompt;\s*if \(!prompt\) return false;\s*this\.pendingPillPrompt = null;\s*this\.inputEl\.value = prompt;\s*void this\.send\(\);\s*return true;\s*\}/,
  );
});
