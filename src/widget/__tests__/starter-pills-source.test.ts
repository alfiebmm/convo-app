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

test("starter pill clicks buffer the prompt and defer/flush via qualifying gate", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private flushPill(): boolean {",
  );

  // The buffer field exists on the class.
  assert.match(
    widgetSource,
    /private pendingPillPrompt: string \| null = null;/,
  );

  // Handler opens the panel, buffers the prompt, then either flushes
  // immediately (no qualifying pending) or defers by leaving the buffer
  // set. Same code path for both branches keeps size + reasoning simple.
  assert.match(
    handler,
    /if \(!this\.isOpen\) this\.toggle\(\);[\s\S]*?if \(!action \|\| action\.type === "chat"\) \{[\s\S]*?this\.pendingPillPrompt = pill\.prompt;\s*if \(!this\.nextQualifyingPrompt\(\)\) this\.flushPill\(\);/,
  );
});

test("starter pill lead_capture buffers and flushes through pill-init", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private flushPill(): boolean {",
  );

  assert.match(
    widgetSource,
    /private pendingPillLeadCapture: PillLeadCaptureAction \| null = null;/,
  );
  assert.match(
    handler,
    /if \(action\.type === "lead_capture"\) \{[\s\S]*?this\.pendingPillLeadCapture = action;\s*if \(!this\.nextQualifyingPrompt\(\)\) this\.flushPendingLeadCapture\(\);/,
  );
  assert.match(
    widgetSource,
    /fetch\(`\$\{this\.config\.apiBase\}\/api\/cases\/pill-init`[\s\S]*?capture_policy_id: action\.capture_policy\.id,[\s\S]*?this\.mountCaptureFlow\([\s\S]*?capture_policy: action\.capture_policy,[\s\S]*?action\.field_label_overrides,/,
  );
});

test("starter pill booking_form renders a placeholder message", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private flushPill(): boolean {",
  );

  assert.match(
    handler,
    /Booking form coming soon — please use Get in touch or free-text below\./,
  );
});

test("qualifying completion flushes buffered pill actions instead of greeting", () => {
  const flushCount = widgetSource.match(
    /this\.setInputLocked\(false\);\s*if \(this\.flushPill\(\) \|\| this\.flushPendingLeadCapture\(\)\) \{\s*return;\s*\}/g,
  )?.length;

  assert.equal(flushCount, 2);
  assert.match(
    widgetSource,
    /private flushPill\(\): boolean \{\s*const prompt = this\.pendingPillPrompt;\s*if \(!prompt\) return false;\s*this\.pendingPillPrompt = null;\s*this\.inputEl\.value = prompt;\s*void this\.send\(\);\s*return true;\s*\}/,
  );
  assert.match(
    widgetSource,
    /private flushPendingLeadCapture\(\): boolean \{\s*const action = this\.pendingPillLeadCapture;\s*if \(!action\) return false;\s*this\.pendingPillLeadCapture = null;\s*void this\.startPillLeadCapture\(action\);\s*return true;\s*\}/,
  );
});
