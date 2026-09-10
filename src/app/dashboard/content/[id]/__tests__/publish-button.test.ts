import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

import { PublishBlogPostButton } from "../publish-blog-post-button";

function buttonMarkup(props: Parameters<typeof PublishBlogPostButton>[0]) {
  return renderToStaticMarkup(React.createElement(PublishBlogPostButton, props));
}

function setupDom() {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "https://app.test/dashboard/content/post-1",
  });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  const previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;

  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;

  let root: Root | null = null;
  const cleanup = async () => {
    await act(async () => {
      root?.unmount();
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.fetch = previousFetch;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      previousActEnvironment;
  };

  const container = dom.window.document.getElementById("root");
  assert.ok(container);

  return {
    container,
    cleanup,
    render(element: React.ReactElement) {
      root = createRoot(container);
      act(() => {
        root?.render(element);
      });
    },
  };
}

test("publish button is disabled when WordPress is not connected", () => {
  const markup = buttonMarkup({
    postId: "post-1",
    status: "approved",
    wordpressSiteUrl: null,
  });

  assert.match(markup, /disabled/);
  assert.match(markup, /Connect WordPress in Settings/);
});

test("publish button is disabled when status is not publishable", () => {
  const markup = buttonMarkup({
    postId: "post-1",
    status: "rejected",
    wordpressSiteUrl: "https://doggo.com.au",
  });

  assert.match(markup, /disabled/);
  assert.match(markup, /Cannot publish from rejected status/);
});

test("confirm modal renders the WordPress site URL", async () => {
  const dom = setupDom();
  try {
    dom.render(
      React.createElement(PublishBlogPostButton, {
        postId: "post-1",
        status: "approved",
        wordpressSiteUrl: "https://doggo.com.au",
      }),
    );

    const publishButton = dom.container.querySelector("button");
    assert.ok(publishButton);
    act(() => {
      publishButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });

    assert.match(
      dom.container.textContent ?? "",
      /Publish this article to https:\/\/doggo\.com\.au\?/,
    );
  } finally {
    await dom.cleanup();
  }
});

test("success and failure notices show WordPress URL and exact error", async () => {
  const dom = setupDom();
  try {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      if (fetchCalls === 1) {
        return Response.json({
          ok: true,
          wpPostUrl: "https://doggo.com.au/live-article/",
        });
      }
      return Response.json(
        { ok: false, error: "WordPress credentials were rejected" },
        { status: 400 },
      );
    }) as typeof fetch;

    dom.render(
      React.createElement(PublishBlogPostButton, {
        postId: "post-1",
        status: "approved",
        wordpressSiteUrl: "https://doggo.com.au",
        onPublished: () => undefined,
      }),
    );

    const openPublishDialog = () => {
      const publishButton = dom.container.querySelector("button");
      assert.ok(publishButton);
      act(() => {
        publishButton.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      });
    };
    const confirmPublish = async () => {
      const buttons = [...dom.container.querySelectorAll("button")];
      const confirm = buttons
        .reverse()
        .find((button) => button.textContent === "Publish");
      assert.ok(confirm);
      await act(async () => {
        confirm.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      });
    };

    openPublishDialog();
    await confirmPublish();
    assert.match(dom.container.textContent ?? "", /Article published to WordPress/);
    assert.match(dom.container.innerHTML, /https:\/\/doggo\.com\.au\/live-article\//);

    openPublishDialog();
    await confirmPublish();
    assert.match(
      dom.container.textContent ?? "",
      /WordPress credentials were rejected/,
    );
  } finally {
    await dom.cleanup();
  }
});
