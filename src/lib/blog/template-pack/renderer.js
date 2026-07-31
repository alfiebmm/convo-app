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
module.exports = { render };
