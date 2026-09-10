#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// renderer.js — GH Blog Template Pack renderer
// Usage: node renderer.js --brand brand.json --post post.json --out output.html
'use strict';

const fs         = require('fs');
const path       = require('path');
const Handlebars = require('handlebars');
const { validate, loadJson } = require('./validate.js');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { out[a.slice(2)] = argv[++i]; }
  }
  return out;
}

// Handlebars helpers
Handlebars.registerHelper('eq', function (a, b, options) {
  return a === b ? options.fn(this) : options.inverse(this);
});
Handlebars.registerHelper('inc', function (n) { return Number(n) + 1; });
Handlebars.registerHelper('default', function (val, fallback) {
  return (val === undefined || val === null || val === '') ? fallback : val;
});
Handlebars.registerHelper('json', function (val) {
  // Emits a JSON literal safe for use inside a <script type="application/ld+json"> block.
  return new Handlebars.SafeString(JSON.stringify(val == null ? '' : val));
});
Handlebars.registerHelper('join', function (arr, sep) {
  if (!Array.isArray(arr)) return '';
  return arr.join(typeof sep === 'string' ? sep : ', ');
});
Handlebars.registerHelper('rgba', function (hex, alpha) {
  if (typeof hex !== 'string') return 'rgba(0,0,0,' + alpha + ')';
  const h = hex.replace('#','').trim();
  let r, g, b;
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else if (h.length === 6) {
    r = parseInt(h.slice(0,2), 16);
    g = parseInt(h.slice(2,4), 16);
    b = parseInt(h.slice(4,6), 16);
  } else {
    return 'rgba(0,0,0,' + alpha + ')';
  }
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
});

function render({ brand, post, stylesPath, templatePath }) {
  const styles   = fs.readFileSync(stylesPath, 'utf8');
  const tplSrc   = fs.readFileSync(templatePath, 'utf8');
  const template = Handlebars.compile(tplSrc, { noEscape: false });
  return template({ brand, post, styles });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function sanitizeHref(value) {
  const href = String(value == null ? '' : value).trim();
  if (!href) return '';
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(href)) return href;
  return '';
}

function sanitizeInlineHtml(value) {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/&lt;strong&gt;([\s\S]*?)&lt;\/strong&gt;/gi, '<strong>$1</strong>')
    .replace(/&lt;em&gt;([\s\S]*?)&lt;\/em&gt;/gi, '<em>$1</em>')
    .replace(
      /&lt;a\s+href=&quot;([^&]*)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/gi,
      (_match, href, text) => {
        const safeHref = sanitizeHref(href);
        return safeHref ? `<a href="${escapeAttribute(safeHref)}">${text}</a>` : text;
      }
    )
    .replace(
      /&lt;a\s+href=&#39;([^&]*)&\#39;&gt;([\s\S]*?)&lt;\/a&gt;/gi,
      (_match, href, text) => {
        const safeHref = sanitizeHref(href);
        return safeHref ? `<a href="${escapeAttribute(safeHref)}">${text}</a>` : text;
      }
    );
}

function compact(lines) {
  return lines.filter(Boolean).join('\n');
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}

function articleJsonLd({ brand, post }) {
  const seo = post.seo || {};
  const image = seo.ogImage || (post.hero && post.hero.url) || '';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: seo.metaDescription || post.dek,
    image: [image],
    author: {
      '@type': 'Organization',
      name: seo.authorName || brand.name,
    },
    publisher: {
      '@type': 'Organization',
      name: brand.name,
      logo: {
        '@type': 'ImageObject',
        url: brand.logo && brand.logo.url,
      },
    },
  };

  if (seo.canonicalUrl) {
    data.mainEntityOfPage = {
      '@type': 'WebPage',
      '@id': seo.canonicalUrl,
    };
  }
  if (seo.authoredAt) data.datePublished = seo.authoredAt;
  if (seo.modifiedAt) data.dateModified = seo.modifiedAt;

  return data;
}

function faqJsonLd(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: (post.faqs || []).map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };
}

function renderSemanticBlock(block) {
  if (!block || typeof block !== 'object') return '';

  if (block.type === 'p') return `<p>${sanitizeInlineHtml(block.text)}</p>`;
  if (block.type === 'h3') return `<h3>${sanitizeInlineHtml(block.text)}</h3>`;
  if (block.type === 'ul') {
    return compact([
      '<ul>',
      ...(block.items || []).map((item) => `  <li>${sanitizeInlineHtml(item)}</li>`),
      '</ul>',
    ]);
  }
  if (block.type === 'ol') {
    return compact([
      '<ol>',
      ...(block.items || []).map((item) => `  <li>${sanitizeInlineHtml(item)}</li>`),
      '</ol>',
    ]);
  }
  if (block.type === 'keyTakeaway') {
    return `<blockquote><p><strong>${escapeHtml(block.label || 'Key takeaway')}:</strong> ${sanitizeInlineHtml(block.body)}</p></blockquote>`;
  }
  if (block.type === 'readNext') {
    return compact([
      '<h2>Related</h2>',
      '<ul>',
      ...(block.links || []).map((link) => {
        const href = sanitizeHref(link.url);
        const label = escapeHtml(link.label);
        return href
          ? `  <li><a href="${escapeAttribute(href)}">${label}</a></li>`
          : `  <li>${label}</li>`;
      }),
      '</ul>',
    ]);
  }
  if (block.type === 'cta') {
    const href = sanitizeHref(block.linkUrl);
    const link = href
      ? `<a href="${escapeAttribute(href)}">${escapeHtml(block.linkLabel)} &rarr;</a>`
      : escapeHtml(block.linkLabel);
    return compact([
      block.body ? `<p>${sanitizeInlineHtml(block.body)}</p>` : '',
      `<p><strong>${link}</strong></p>`,
    ]);
  }

  return '';
}

function renderSemantic({ brand, post }) {
  // Structural mapping: omit destination-owned chrome (site header/footer),
  // taxonomy/meta/TOC/compliance chrome, and icon assets; keep content,
  // media, CTA, related links, FAQ, and JSON-LD as semantic HTML.
  const lines = [
    jsonLdScript(articleJsonLd({ brand, post })),
    Array.isArray(post.faqs) && post.faqs.length ? jsonLdScript(faqJsonLd(post)) : '',
    `<h1>${escapeHtml(post.title)}</h1>`,
    post.dek ? `<p>${escapeHtml(post.dek)}</p>` : '',
  ];

  if (post.hero && post.hero.url) {
    lines.push(
      '<figure>',
      `  <img src="${escapeAttribute(post.hero.url)}" alt="${escapeAttribute(post.hero.alt || '')}" />`,
      post.hero.alt ? `  <figcaption>${escapeHtml(post.hero.alt)}</figcaption>` : '',
      '</figure>'
    );
  }

  if (Array.isArray(post.stats) && post.stats.length) {
    lines.push(
      '<h2>At a glance</h2>',
      '<ul>',
      ...post.stats.map(
        (stat) => `  <li><strong>${escapeHtml(stat.value)}</strong> &mdash; ${escapeHtml(stat.label)}</li>`
      ),
      '</ul>'
    );
  }

  if (post.intro) lines.push(`<p>${sanitizeInlineHtml(post.intro)}</p>`);

  for (const section of post.sections || []) {
    lines.push(`<h2>${escapeHtml(section.heading)}</h2>`);
    for (const block of section.blocks || []) {
      lines.push(renderSemanticBlock(block));
    }
  }

  if (Array.isArray(post.faqs) && post.faqs.length) {
    lines.push('<h2>FAQ</h2>');
    for (const faq of post.faqs) {
      lines.push(`<h3>${escapeHtml(faq.q)}</h3>`, `<p>${sanitizeInlineHtml(faq.a)}</p>`);
    }
  }

  if (Array.isArray(post.related) && post.related.length) {
    lines.push(
      '<h2>Related</h2>',
      '<ul>',
      ...post.related.map((related) => {
        const href = sanitizeHref(related.url);
        const title = escapeHtml(related.title);
        return href
          ? `  <li><a href="${escapeAttribute(href)}">${title}</a></li>`
          : `  <li>${title}</li>`;
      }),
      '</ul>'
    );
  }

  return compact(lines) + '\n';
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.brand || !args.post || !args.out) {
    console.error('Usage: node renderer.js --brand <brand.json> --post <post.json> --out <output.html>');
    process.exit(2);
  }
  const brand = loadJson(args.brand);
  const post  = loadJson(args.post);

  const errors = validate({ brand, post });
  if (errors.length > 0) {
    console.error('VALIDATION FAILED:');
    for (const e of errors) {
      console.error('  ' + e.file + ':');
      for (const err of e.errors) {
        console.error('    ' + err.instancePath + ' ' + err.message);
      }
    }
    process.exit(1);
  }

  const html = render({
    brand,
    post,
    stylesPath:   path.join(__dirname, '_tokenised.css'),
    templatePath: path.join(__dirname, 'template.html'),
  });

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html, 'utf8');
  console.log('Wrote ' + outPath + ' (' + html.length + ' bytes)');
}

if (require.main === module) main();
module.exports = { render, renderSemantic };
