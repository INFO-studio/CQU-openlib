import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { match } from 'ts-pattern';
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

const printHelp = () => {
  console.log(`Usage: pnpm logo:generate -- [options]

Options:
  --size <n>         Master PNG edge length (default 4096)
  --web-png <n>      Site PNG edge length (default 512); 0 to skip
  --out <dir>        Site asset directory (default public/assets/logo)
  --master-out <dir> High-res PNG directory (default tools/logo/out)
  --font <path>      OFL serif TTF (default tools/logo/fonts/AbhayaLibre-Regular.ttf)
`);
};

const parseArgs = (argv: string[]): CliOptions => {
  const defaults: CliOptions = {
    size: 4096,
    webDir: join(ROOT, 'public/assets/logo'),
    masterDir: join(TOOL_ROOT, 'out'),
    fontPath: defaultFontPath(),
    webPng: 512,
  };
  const { options } = argv.reduce(
    (state, arg, index) => {
      if (index < state.next || arg === '--') return state;
      if (arg === '--help' || arg === '-h') {
        printHelp();
        process.exit(0);
      }
      const next = argv[index + 1];
      if (!next) return state;
      const patch = match(arg)
        .with('--size', () => ({ size: Number(next) }))
        .with('--out', () => ({ webDir: resolve(next) }))
        .with('--master-out', () => ({ masterDir: resolve(next) }))
        .with('--font', () => ({ fontPath: resolve(next) }))
        .with('--web-png', () => ({ webPng: Number(next) }))
        .otherwise(() => null);
      return patch
        ? { options: { ...state.options, ...patch }, next: index + 2 }
        : state;
    },
    { options: defaults, next: 0 },
  );
  const { size, webPng, fontPath } = options;
  if (!Number.isFinite(size) || size < 64 || size > 8192) {
    throw new Error(`--size must be between 64 and 8192, got ${size}`);
  }
  if (!Number.isFinite(webPng) || webPng < 0 || webPng > 2048) {
    throw new Error(`--web-png must be between 0 and 2048, got ${webPng}`);
  }
  if (!existsSync(fontPath)) throw new Error(`Font not found: ${fontPath}`);
  return options;
};

const FILE_STEM: Record<LogoPolarity, string> = {
  'on-light': 'openlib-logo-light',
  'on-dark': 'openlib-logo-dark',
};

const writePng = async (svg: string, filePath: string, size: number) => {
  const buf = await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(filePath, buf);
};

const main = async () => {
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
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
