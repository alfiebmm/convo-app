/**
 * CON-299 — restore chat input focus after assistant turns.
 *
 * Run with:
 *   npx tsx --test src/widget/__tests__/input-refocus.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const tenantId = "a1111111-1111-4111-8111-111111111111";

function streamResponse(content: string): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            [
              `data: ${JSON.stringify({ type: "meta", conversationId: "conv-1" })}`,
              `data: ${JSON.stringify({ type: "token", content })}`,
              "",
            ].join("\n"),
          ),
        );
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

async function setupWidget() {
  const dom = new JSDOM(
    `<!doctype html><body><script data-tenant="${tenantId}" src="https://app.example/widget.js"></script></body>`,
    { url: "https://tenant.example/page" },
  );
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    sessionStorage: globalThis.sessionStorage,
    crypto: globalThis.crypto,
    fetch: globalThis.fetch,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };
  const rafCallbacks: FrameRequestCallback[] = [];

  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.fetch = async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes("/api/widget/config")) {
      return new Response(
        JSON.stringify({
          welcomeEnabled: false,
          streaming: { thinkingMinMs: 0, tokensPerSecond: 200 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (href.includes("/api/chat")) return streamResponse("Done.");
    return new Response("{}", { status: 200 });
  };
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { randomUUID: () => "visitor-id" },
  });
  Object.defineProperty(dom.window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    },
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    value: dom.window.requestAnimationFrame,
  });
  Object.defineProperty(dom.window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });

  await import(`../index.ts?con299=${Date.now()}`);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  await new Promise((resolve) => setTimeout(resolve, 20));

  const host = dom.window.document.querySelector("#convo-widget");
  assert.ok(host?.shadowRoot, "widget shadow root exists");
  const shadow = host.shadowRoot;
  const bubble = shadow.querySelector(".convo-bubble") as HTMLButtonElement;
  const input = shadow.querySelector(".convo-input-area input") as HTMLInputElement;
  const send = shadow.querySelector(".convo-input-area button") as HTMLButtonElement;
  const messages = shadow.querySelector(".convo-messages") as HTMLDivElement;
  const close = shadow.querySelector(".convo-close") as HTMLButtonElement;

  bubble.click();

  return {
    dom,
    shadow,
    input,
    send,
    messages,
    close,
    rafCallbacks,
    restore() {
      close.click();
      dom.window.close();
      globalThis.window = previous.window;
      globalThis.document = previous.document;
      globalThis.localStorage = previous.localStorage;
      globalThis.sessionStorage = previous.sessionStorage;
      globalThis.fetch = previous.fetch;
      Object.defineProperty(globalThis, "requestAnimationFrame", {
        configurable: true,
        value: previous.requestAnimationFrame,
      });
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: previous.crypto,
      });
    },
  };
}

async function waitForPendingRefocus(rafCallbacks: FrameRequestCallback[]): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if (rafCallbacks.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("expected a pending input-refocus animation frame");
}

async function sendMessage(
  widget: Awaited<ReturnType<typeof setupWidget>>,
  text: string,
  via: "button" | "enter",
): Promise<void> {
  widget.input.value = text;
  widget.input.focus();
  if (via === "button") {
    widget.send.click();
  } else {
    widget.input.dispatchEvent(
      new widget.dom.window.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
      }),
    );
  }
  await waitForPendingRefocus(widget.rafCallbacks);
}

function flushRefocus(widget: Awaited<ReturnType<typeof setupWidget>>): void {
  const callback = widget.rafCallbacks.shift();
  assert.ok(callback, "refocus callback exists");
  callback(0);
}

test("assistant completion refocuses input without stealing guarded focus", async () => {
  const widget = await setupWidget();
  try {
    await sendMessage(widget, "Button send", "button");
    flushRefocus(widget);
    assert.equal(widget.shadow.activeElement, widget.input);

    await sendMessage(widget, "Enter send", "enter");
    flushRefocus(widget);
    assert.equal(widget.shadow.activeElement, widget.input);

    const cases: Array<{
      name: string;
      build: () => HTMLElement;
    }> = [
      {
        name: "active capture field",
        build: () => {
          const block = document.createElement("div");
          block.className = "convo-cap-block";
          const form = document.createElement("form");
          const field = document.createElement("input");
          field.className = "convo-cap-input";
          form.appendChild(field);
          block.appendChild(form);
          widget.messages.appendChild(block);
          return field;
        },
      },
      {
        name: "qualifying control",
        build: () => {
          const block = document.createElement("div");
          block.className = "convo-qualifying";
          const button = document.createElement("button");
          button.type = "button";
          block.appendChild(button);
          widget.messages.appendChild(block);
          return button;
        },
      },
      {
        name: "close button",
        build: () => widget.close,
      },
      {
        name: "CTA link",
        build: () => {
          const link = document.createElement("a");
          link.className = "convo-cta-button";
          link.href = "https://example.com";
          widget.messages.appendChild(link);
          return link;
        },
      },
      {
        name: "embedded form",
        build: () => {
          const block = document.createElement("div");
          block.className = "convo-card";
          const frame = document.createElement("iframe");
          block.appendChild(frame);
          widget.messages.appendChild(block);
          return frame;
        },
      },
    ];

    for (const guardCase of cases) {
      widget.messages.replaceChildren();
      await sendMessage(widget, `Guard ${guardCase.name}`, "enter");
      const active = guardCase.build();
      active.focus();
      flushRefocus(widget);
      assert.equal(
        widget.shadow.activeElement,
        active,
        `${guardCase.name} keeps focus`,
      );
    }
  } finally {
    widget.restore();
  }
});
