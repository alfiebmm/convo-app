import * as cheerio from "cheerio";

const ALLOWED_TAGS = new Set(["p", "br", "strong", "em", "a"]);
const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function isSafeHref(raw: string) {
  try {
    const url = new URL(raw, "https://convo.local");
    return ALLOWED_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

export function sanitizeCaseNoteHtml(input: string): string {
  const $ = cheerio.load(input, null, false);

  $("b").each((_, element) => {
    $(element).replaceWith(`<strong>${$(element).html() ?? ""}</strong>`);
  });
  $("i").each((_, element) => {
    $(element).replaceWith(`<em>${$(element).html() ?? ""}</em>`);
  });

  $("*").each((_, element) => {
    const node = $(element);
    const tagName = String(node.prop("tagName") ?? "").toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      node.replaceWith(node.contents());
      return;
    }

    for (const attr of Object.keys(node.attr() ?? {})) {
      if (tagName !== "a" || attr !== "href") {
        node.removeAttr(attr);
      }
    }

    if (tagName === "a") {
      const href = node.attr("href")?.trim() ?? "";
      if (!href || !isSafeHref(href)) {
        node.replaceWith(node.contents());
      } else {
        node.attr("href", href);
        node.attr("rel", "noreferrer");
        node.attr("target", "_blank");
      }
    }
  });

  const html = $.root().html()?.trim() ?? "";
  return html.replace(/(?:<br\s*\/?>|\s|&nbsp;)+$/gi, "").trim();
}
