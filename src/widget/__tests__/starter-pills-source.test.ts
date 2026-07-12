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
    "private flushPendingPillAction(): boolean {",
  );

  // The buffer field exists on the class.
  assert.match(
    widgetSource,
    /private pendingPillAction: PillAction \| null = null;/,
  );

  // Handler opens the panel, buffers the prompt, then either flushes
  // immediately (no qualifying pending) or defers by leaving the buffer
  // set. Same code path for both branches keeps size + reasoning simple.
  assert.match(
    handler,
    /if \(!this\.isOpen\) this\.toggle\(\);[\s\S]*?if \(!action \|\| action\.type === "chat"\) \{[\s\S]*?this\.pendingPillAction = \{ type: "chat", prompt: pill\.prompt \};\s*if \(!this\.nextQualifyingPrompt\(\)\) this\.flushPendingPillAction\(\);/,
  );
});

test("starter pill lead_capture buffers and flushes through pill-init", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private flushPendingPillAction(): boolean {",
  );

  assert.match(
    handler,
    /this\.pendingPillAction = action;\s*if \(!this\.nextQualifyingPrompt\(\)\) this\.flushPendingPillAction\(\);/,
  );
  assert.match(
    widgetSource,
    /fetch\(`\$\{this\.config\.apiBase\}\/api\/cases\/pill-init`[\s\S]*?capture_policy_id: action\.capture_policy\.id,[\s\S]*?this\.mountCaptureFlow\([\s\S]*?capture_policy: action\.capture_policy,[\s\S]*?action\.field_label_overrides,/,
  );
});

test("starter pill booking_form remains a deprecated no-op", () => {
  assert.match(
    widgetSource,
    /\/\/ Deprecated no-op placeholder\. Configs still parse, but no UI\/action runs\.\s*return true;/,
  );
});

test("starter pill custom_embed renders sandboxed iframe locally", () => {
  const renderCustomEmbed = sourceBetween(
    "private renderCustomEmbed(action: PillCustomEmbedAction): void {",
    "private async startPillLeadCapture",
  );

  assert.match(renderCustomEmbed, /frame\.src = action\.url;/);
  assert.match(renderCustomEmbed, /frame\.height = String\(action\.height \?\? 520\);/);
  assert.match(
    renderCustomEmbed,
    /frame\.style\.cssText = "width:100%;border:0;border-radius:10px;background:#f8fafc";/,
  );
  assert.match(
    renderCustomEmbed,
    /frame\.setAttribute\(\s*"sandbox",\s*"allow-scripts allow-forms allow-same-origin allow-popups",\s*\);/,
  );
  assert.match(
    renderCustomEmbed,
    /frame\.referrerPolicy = "strict-origin-when-cross-origin";/,
  );
  assert.match(renderCustomEmbed, /frame\.loading = "lazy";/);
  assert.match(renderCustomEmbed, /if \(action\.allow\) frame\.allow = action\.allow;/);
  assert.doesNotMatch(renderCustomEmbed, /allow-top-navigation/);
  assert.doesNotMatch(renderCustomEmbed, /\/api\/cases\/pill-init|\/api\/chat/);
  assert.match(renderCustomEmbed, /close\.addEventListener\("click", \(\) => \{[\s\S]*?block\.remove\(\);/);
});

test("qualifying completion flushes buffered pill action instead of greeting", () => {
  const flushCount = widgetSource.match(
    /this\.setInputLocked\(false\);\s*if \(this\.flushPendingPillAction\(\)\) \{\s*return;\s*\}/g,
  )?.length;

  assert.equal(flushCount, 2);
  assert.match(
    widgetSource,
    /private flushPendingPillAction\(\): boolean \{\s*const action = this\.pendingPillAction;\s*if \(!action\) return false;\s*this\.pendingPillAction = null;[\s\S]*?if \(action\.type === "chat"\) \{[\s\S]*?this\.inputEl\.value = action\.prompt;\s*void this\.send\(\);[\s\S]*?if \(action\.type === "lead_capture"\) \{[\s\S]*?void this\.startPillLeadCapture\(action\);[\s\S]*?if \(action\.type === "custom_embed"\) \{[\s\S]*?this\.renderCustomEmbed\(action\);/,
  );
});
