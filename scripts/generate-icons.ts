import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

/** Marca: surdo visto desde arriba sobre el violeta de la app. */
function markSvg(size: number, padding: number): string {
  const inner = size - padding * 2;
  const cx = size / 2;
  const cy = size / 2;
  const r = inner * 0.38;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#1a1726"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#2a2438" stroke="#e8b84a" stroke-width="${size * 0.045}"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="none" stroke="#e8b84a" stroke-width="${size * 0.018}" opacity="0.85"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="#e8b84a"/>
</svg>`;
}

async function png(size: number, padding: number, name: string): Promise<void> {
  const buffer = await sharp(Buffer.from(markSvg(size, padding)))
    .png()
    .toBuffer();
  await writeFile(join(outDir, name), buffer);
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await png(192, 0, "icon-192.png");
  await png(512, 0, "icon-512.png");
  // Zona segura ~80 % para iconos maskable (Android).
  await png(512, 56, "icon-maskable-512.png");
}

void main();
