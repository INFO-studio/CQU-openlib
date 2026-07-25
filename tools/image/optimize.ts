/**
 * One-off batch optimiser for the images under public/doc.
 *
 * Rasters are capped at MAX_WIDTH and re-encoded to WebP in place; every
 * Markdown reference is rewritten to match. Dimensions land in
 * metadata/image-sizes.json so the renderer can reserve the box before the
 * bytes arrive. Usage and the skip rules are in the root README.
 *
 *   pnpm image:optimize [--dry]
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { extname, join, relative } from 'node:path';
import sharp from 'sharp';

const DOC_ROOT = 'public/doc';
/** Files outside the doc tree that may also link to an image. */
const EXTRA_REFERENCE_FILES = ['public/llms.txt'];
const MANIFEST = 'metadata/image-sizes.json';
/** Owned by tools/logo/generate.ts, which re-emits PNG on every run. */
const SKIP_DIRS = new Set(['assets']);

/** Prose column is ~800 CSS px, so 1600 already covers a 2x display. */
const MAX_WIDTH = 1600;
const QUALITY = 80;

const RASTER = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.tiff',
  '.webp',
]);
const REWRITABLE = /\.(mdx?|txt)$/i;

const dryRun = process.argv.includes('--dry');

/**
 * `[label](url){:download="name.png"}` promises a file in a specific format —
 * the brand assets under 学业_重庆大学视觉形象 are published that way. Re-encoding
 * those would hand the reader a WebP wearing a .png name.
 */
const DOWNLOAD_LINK = /\(([^)\s]+)\)\{:download=/g;

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(full));
    } else out.push(full);
  }
  return out;
};

const docUrl = (file: string): string =>
  `/doc/${relative(DOC_ROOT, file).replace(/\\/g, '/')}`;

const mb = (bytes: number): string => (bytes / 1048576).toFixed(2);

const referenceFiles = [
  ...walk(DOC_ROOT).filter((f) => REWRITABLE.test(f)),
  ...EXTRA_REFERENCE_FILES,
];

/** Image URLs published as downloads, whose file format is part of the offer. */
const pinnedUrls = new Set<string>();
for (const file of referenceFiles) {
  for (const [, url] of readFileSync(file, 'utf8').matchAll(DOWNLOAD_LINK)) {
    try {
      pinnedUrls.add(decodeURI(url));
    } catch {
      pinnedUrls.add(url);
    }
  }
}

type Result = {
  from: string;
  to: string;
  before: number;
  after: number;
  width: number;
  height: number;
};

const optimise = async (file: string): Promise<Result> => {
  const before = statSync(file).size;
  const input = { limitInputPixels: false } as const;
  const meta = await sharp(file, input).metadata();
  // EXIF orientation ≥5 swaps the axes; browsers honour it, metadata does not.
  const turned = (meta.orientation ?? 0) >= 5;
  const srcWidth = (turned ? meta.height : meta.width) ?? 0;
  const srcHeight = (turned ? meta.width : meta.height) ?? 0;

  const keep = (): Result => ({
    from: file,
    to: file,
    before,
    after: before,
    width: srcWidth,
    height: srcHeight,
  });

  // Animated frames would collapse to a still; leave them alone.
  if ((meta.pages ?? 1) > 1) return keep();
  if (pinnedUrls.has(docUrl(file))) return keep();
  // Already-converted output: re-encoding it would only add generation loss,
  // so a rerun after new images land is safe.
  if (meta.format === 'webp' && srcWidth <= MAX_WIDTH) return keep();

  const pipeline = sharp(file, input).rotate();
  if (srcWidth > MAX_WIDTH) {
    pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
  }
  const buffer = await pipeline
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();
  if (buffer.length >= before) return keep();

  const encoded = await sharp(buffer).metadata();
  const target = `${file.slice(0, -extname(file).length)}.webp`;
  if (target !== file && existsSync(target)) {
    throw new Error(`${target} already exists — rename one of the sources`);
  }
  if (!dryRun) {
    writeFileSync(target, buffer);
    if (target !== file) rmSync(file);
  }
  return {
    from: file,
    to: target,
    before,
    after: buffer.length,
    width: encoded.width ?? 0,
    height: encoded.height ?? 0,
  };
};

const rewriteReferences = (renames: Map<string, string>): number => {
  if (!renames.size) return 0;
  let touched = 0;
  for (const file of referenceFiles) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const next = [...renames].reduce((acc, [from, to]) => {
      // Authors write the path raw or percent-encoded; both must resolve.
      return acc
        .split(from)
        .join(to)
        .split(encodeURI(from))
        .join(encodeURI(to));
    }, text);
    if (next === text) continue;
    touched += 1;
    if (!dryRun) writeFileSync(file, next, 'utf8');
  }
  return touched;
};

const files = walk(DOC_ROOT).filter((f) =>
  RASTER.has(extname(f).toLowerCase()),
);

const results: Result[] = [];
for (const file of files) results.push(await optimise(file));

const renames = new Map(
  results
    .filter((r) => r.from !== r.to)
    .map((r) => [docUrl(r.from), docUrl(r.to)]),
);
const touched = rewriteReferences(renames);

const sizes: Record<string, [number, number]> = {};
for (const r of results.sort((a, b) => a.to.localeCompare(b.to))) {
  if (r.width && r.height) sizes[docUrl(r.to)] = [r.width, r.height];
}
if (!dryRun) {
  writeFileSync(MANIFEST, `${JSON.stringify(sizes, null, 2)}\n`, 'utf8');
}

const before = results.reduce((a, r) => a + r.before, 0);
const after = results.reduce((a, r) => a + r.after, 0);
const saved = results
  .filter((r) => r.before !== r.after)
  .sort((a, b) => b.before - b.after - (a.before - a.after));

console.log(dryRun ? '— dry run, nothing written —\n' : '');
for (const r of saved.slice(0, 10)) {
  console.log(
    `${mb(r.before).padStart(7)} → ${mb(r.after).padStart(6)} MB  ${relative(DOC_ROOT, r.to)}`,
  );
}
console.log(
  `\n${results.length} 张：${mb(before)} MB → ${mb(after)} MB（省 ${(100 - (after / before) * 100).toFixed(1)}%）`,
);
console.log(`重命名 ${renames.size} 个文件，改写 ${touched} 个引用文件`);
console.log(`尺寸清单 ${MANIFEST}：${Object.keys(sizes).length} 条`);
