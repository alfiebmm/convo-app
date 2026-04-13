import * as esbuild from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [resolve(__dirname, "../src/widget/index.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  outfile: resolve(__dirname, "../public/widget.js"),
  sourcemap: false,
  logLevel: "info",
});
