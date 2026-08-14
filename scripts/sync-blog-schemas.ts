import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE = "/Users/ghg-convo/workspace/blog-template-pack";
const ROOT = process.cwd();
const SCHEMA_TARGET = path.join(ROOT, "src/lib/blog/schemas");
const PACK_TARGET = path.join(ROOT, "src/lib/blog/template-pack");

const schemaFiles = [
  "post.schema.json",
  "brand.schema.json",
  "post.example.chemist2u.json",
  "brand.example.chemist2u.json",
];

const packFiles = [
  "renderer.js",
  "validate.js",
  "template.html",
  "_tokenised.css",
  "post.schema.json",
  "brand.schema.json",
];

async function copyFiles(files: string[], target: string) {
  await mkdir(target, { recursive: true });
  for (const file of files) {
    await cp(path.join(SOURCE, file), path.join(target, file));
  }
}

async function ensureLintHeader(file: string) {
  const target = path.join(PACK_TARGET, file);
  const source = await readFile(target, "utf8");
  const header = "/* eslint-disable @typescript-eslint/no-require-imports */";
  if (source.includes(header)) return;
  await writeFile(
    target,
    source.replace("#!/usr/bin/env node\n", `#!/usr/bin/env node\n${header}\n`)
  );
}

async function main() {
  await copyFiles(schemaFiles, SCHEMA_TARGET);
  await copyFiles(packFiles, PACK_TARGET);
  await ensureLintHeader("renderer.js");
  await ensureLintHeader("validate.js");
  console.log("Synced blog template schemas and renderer mirror.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
