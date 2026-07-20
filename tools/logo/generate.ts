/**
 * Generate CQU-openlib logo assets (SVG + PNG) for on-light / on-dark.
 *
 *   pnpm logo:generate
 *   pnpm logo:generate -- --size 4096
 *
 * Site assets → public/doc/assets (SVG + small PNG)
 * Master PNGs → tools/logo/out (high-res, not deployed)
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  defaultFontPath,
  type LogoPolarity,
  loadLogoFont,
  renderLogoSvg,
} from './render';

const TOOL_ROOT = dirname(fileURLToPath(import.meta.url));
const ROOT = join(TOOL_ROOT, '../..');

type CliOptions = {
  size: number;
  webDir: string;
  masterDir: string;
  fontPath: string;
  webPng: number;
};

function parseArgs(argv: string[]): CliOptions {
  let size = 4096;
  let webDir = join(ROOT, 'public/doc/assets');
  let masterDir = join(TOOL_ROOT, 'out');
  let fontPath = defaultFontPath();
  let webPng = 512;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--') continue;
    if (arg === '--size' && next) {
      size = Number(next);
      i++;
    } else if (arg === '--out' && next) {
      webDir = resolve(next);
      i++;
    } else if (arg === '--master-out' && next) {
      masterDir = resolve(next);
      i++;
    } else if (arg === '--font' && next) {
      fontPath = resolve(next);
      i++;
    } else if (arg === '--web-png' && next) {
      webPng = Number(next);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!Number.isFinite(size) || size < 64 || size > 8192) {
    throw new Error(`--size must be between 64 and 8192, got ${size}`);
  }
  if (!Number.isFinite(webPng) || webPng < 0 || webPng > 2048) {
    throw new Error(`--web-png must be between 0 and 2048, got ${webPng}`);
  }
  if (!existsSync(fontPath)) {
    throw new Error(`Font not found: ${fontPath}`);
  }

  return { size, webDir, masterDir, fontPath, webPng };
}

function printHelp() {
  console.log(`Usage: pnpm logo:generate -- [options]

Options:
  --size <n>         Master PNG edge length (default 4096)
  --web-png <n>      Site PNG edge length (default 512); 0 to skip
  --out <dir>        Site asset directory (default public/doc/assets)
  --master-out <dir> High-res PNG directory (default tools/logo/out)
  --font <path>      OFL serif TTF (default tools/logo/fonts/AbhayaLibre-Regular.ttf)
`);
}

const FILE_STEM: Record<LogoPolarity, string> = {
  'on-light': 'openlib-logo-light',
  'on-dark': 'openlib-logo-dark',
};

async function writePng(svg: string, filePath: string, size: number) {
  // Render SVG at native viewBox sharpness, then resize with lanczos — no blurry upscale.
  const buf = await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(filePath, buf);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const font = loadLogoFont(opts.fontPath);

  mkdirSync(opts.webDir, { recursive: true });
  mkdirSync(opts.masterDir, { recursive: true });

  const polarities = Object.keys(FILE_STEM) as LogoPolarity[];
  for (const polarity of polarities) {
    const stem = FILE_STEM[polarity];
    const svg = renderLogoSvg({ polarity, font });

    const svgPath = join(opts.webDir, `${stem}.svg`);
    writeFileSync(svgPath, svg, 'utf8');
    console.log(`wrote ${svgPath}`);

    const masterPath = join(opts.masterDir, `${stem}-${opts.size}.png`);
    await writePng(svg, masterPath, opts.size);
    console.log(`wrote ${masterPath}`);

    if (opts.webPng > 0) {
      const webPath = join(opts.webDir, `${stem}.png`);
      await writePng(svg, webPath, opts.webPng);
      console.log(`wrote ${webPath}`);
    }
  }

  if (opts.webPng > 0) {
    const lightSvg = renderLogoSvg({ polarity: 'on-light', font });
    const alias = join(opts.webDir, 'openlib-logo.png');
    await writePng(lightSvg, alias, opts.webPng);
    console.log(`wrote ${alias} (alias → on-light)`);
  }

  console.log(`font: ${opts.fontPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
