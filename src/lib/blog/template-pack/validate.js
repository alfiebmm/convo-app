#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
// validate.js — validate brand + post JSON against schemas
'use strict';

const fs   = require('fs');
const path = require('path');
const Ajv  = require('ajv');

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { out[a.slice(2)] = argv[++i]; }
  }
  return out;
}

function loadJson(p) {
  const abs = path.resolve(p);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}

function validate({ brand, post, schemas } = {}) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  // Prefer pre-loaded schemas (Next.js bundle-safe: `create.ts` static-imports
  // the JSONs and passes them in). Fall back to disk reads for the CLI mode.
  const brandSchema = schemas && schemas.brand
    ? schemas.brand
    : loadJson(path.join(__dirname, 'brand.schema.json'));
  const postSchema = schemas && schemas.post
    ? schemas.post
    : loadJson(path.join(__dirname, 'post.schema.json'));

  const errors = [];
  const brandValidator = ajv.compile(brandSchema);
  if (!brandValidator(brand)) {
    errors.push({ file: 'brand', errors: brandValidator.errors });
  }
  const postValidator = ajv.compile(postSchema);
  if (!postValidator(post)) {
    errors.push({ file: 'post', errors: postValidator.errors });
  }
  return errors;
}

module.exports = { validate, loadJson };

if (require.main === module) {
  const args = parseArgs(process.argv);
  if (!args.brand || !args.post) {
    console.error('Usage: node validate.js --brand <brand.json> --post <post.json>');
    process.exit(2);
  }
  const brand = loadJson(args.brand);
  const post  = loadJson(args.post);
  const errors = validate({ brand, post });
  if (errors.length === 0) {
    console.log('OK: brand + post valid.');
    process.exit(0);
  } else {
    console.error('VALIDATION FAILED:');
    for (const e of errors) {
      console.error('  ' + e.file + ':');
      for (const err of e.errors) {
        console.error('    ' + err.instancePath + ' ' + err.message + ' ' + JSON.stringify(err.params));
      }
    }
    process.exit(1);
  }
}
