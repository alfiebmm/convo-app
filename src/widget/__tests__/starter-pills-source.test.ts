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
import { JSDOM } from "jsdom";

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

test("starter pill chat click sends immediately with optional qualifying directive", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private buildPillQualifyingDirective(): string | null {",
  );

  assert.doesNotMatch(widgetSource, /pendingPillAction|flushPendingPillAction/);
  assert.match(
    handler,
    /if \(!this\.isOpen\) this\.toggle\(\);[\s\S]*?this\.inputEl\.value = pill\.prompt;\s*void this\.send\(this\.buildPillQualifyingDirective\(\)\);/,
  );
});

test("starter pill chat payload carries qualifying system-prompt directive", () => {
  assert.match(
    widgetSource,
    /const pillQualifyingDirective = \(questions: string\[\]\) =>[\s\S]*?Qualifying unanswered:/,
  );
  assert.match(
    widgetSource,
    /\.\.\.\(qd \? \{ qd \} : \{\}\),/,
  );
});

test("starter pill lead_capture bypasses qualifying and routes to pill-init", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private buildPillQualifyingDirective(): string | null {",
  );

  assert.match(
    handler,
    /if \(action\.type === "lead_capture"\) \{\s*this\.clearQ\(\);\s*void this\.startPillLeadCapture\(action\);\s*return;\s*\}/,
  );
  assert.doesNotMatch(handler, /nextQualifyingPrompt\(\)[\s\S]*startPillLeadCapture/);
  assert.match(
    widgetSource,
    /fetch\(`\$\{this\.config\.apiBase\}\/api\/cases\/pill-init`[\s\S]*?capture_policy_id: action\.capture_policy\.id,[\s\S]*?this\.mountCaptureFlow\([\s\S]*?capture_policy: action\.capture_policy,[\s\S]*?action\.field_label_overrides,/,
  );
});

test("starter pill booking_form remains a deprecated no-op", () => {
  assert.match(
    widgetSource,
    /\/\/ Deprecated no-op placeholder\. Configs still parse, but no UI\/action runs\./,
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

test("custom_embed bypasses qualifying and routes directly", () => {
  const handler = sourceBetween(
    "private handleStarterPillClick(pill: StarterPrompt): void {",
    "private buildPillQualifyingDirective(): string | null {",
  );

  assert.match(
    handler,
    /if \(action\.type === "custom_embed"\) \{\s*this\.clearQ\(\);\s*this\.renderCustomEmbed\(action\);\s*return;\s*\}/,
  );
});

test("starter pills stay visible on mobile CSS", () => {
  assert.doesNotMatch(
    widgetSource,
    /@media\(max-width:640px\)\{\.convo-starter-pills\{display:none!important\}\}/,
  );
  assert.match(widgetSource, /env\(safe-area-inset-bottom\)/);
  assert.match(
    widgetSource,
    /@media\(max-width:640px\)\{\.convo-starter-pills\{\$\{mobilePos\}\}\}/,
  );
});

test("rendered starter pills and SVG icons parse in the DOM", async () => {
  const dom = new JSDOM(
    '<!doctype html><body><script data-tenant="a1111111-1111-4111-8111-111111111111" src="https://app.example/widget.js"></script></body>',
    { url: "https://tenant.example/page" },
  );
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    crypto: globalThis.crypto,
    fetch: globalThis.fetch,
  };

  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.fetch = async (url: string | URL | Request) => {
    if (String(url).includes("/api/widget/config")) {
      return new Response(
        JSON.stringify({
          starterPrompts: [
            { emoji: "?", label: "Ask", prompt: "Can you help?" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200 });
  };
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID: () => "visitor-id" },
  });

  try {
    await import("../index");
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    const host = dom.window.document.querySelector("#convo-widget");
    assert.ok(host?.shadowRoot, "widget shadow root exists");
    const pill = host.shadowRoot.querySelector(".convo-starter-pill");
    assert.ok(pill?.classList.contains("convo-starter-pill"), "pill class parsed");
    const bubbleSvg = host.shadowRoot.querySelector(".convo-bubble svg");
    assert.equal(
      bubbleSvg?.namespaceURI,
      "http://www.w3.org/2000/svg",
      "SVG namespace parsed",
    );
  } finally {
    globalThis.window = previous.window;
    globalThis.document = previous.document;
    globalThis.localStorage = previous.localStorage;
    globalThis.sessionStorage = previous.sessionStorage;
    globalThis.fetch = previous.fetch;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: previous.crypto,
    });
  }
});
