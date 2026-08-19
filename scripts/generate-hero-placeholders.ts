import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT_DIR = path.join(process.cwd(), "public/hero-placeholders");

const gradients = [
  { name: "orange", from: "#FF6B2C", to: "#B54B1F" },
  { name: "blue", from: "#2e6dff", to: "#1e4fbf" },
  { name: "green", from: "#2e7d32", to: "#1e5324" },
  { name: "neutral", from: "#71717A", to: "#52525B" },
] as const;

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const gradient of gradients) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${gradient.from}"/>
            <stop offset="1" stop-color="${gradient.to}"/>
          </linearGradient>
        </defs>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
      </svg>
    `;

    const outputPath = path.join(OUTPUT_DIR, `gradient-${gradient.name}.jpg`);
    await sharp(Buffer.from(svg)).jpeg({ quality: 78, mozjpeg: true }).toFile(outputPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
