/**
 * One-off batch optimiser for document images under public/assets/doc.
 *
 * Rasters are capped at MAX_WIDTH and re-encoded to WebP in place; every
 * Markdown reference is rewritten to match. Dimensions land in
 * metadata/image-sizes.json so the renderer can reserve the box before the
 * bytes arrive. Usage and the skip rules are in the documentation skill.
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
const ASSET_ROOT = 'public/assets/doc';
/** Files outside the doc tree that may also link to an image. */
const EXTRA_REFERENCE_FILES = ['public/llms.txt'];
const MANIFEST = 'metadata/image-sizes.json';
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

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });

const assetUrl = (file: string): string =>
  `/assets/doc/${relative(ASSET_ROOT, file).replace(/\\/g, '/')}`;

const mb = (bytes: number): string => (bytes / 1048576).toFixed(2);

const referenceFiles = [
  ...walk(DOC_ROOT).filter((file) => REWRITABLE.test(file)),
  ...EXTRA_REFERENCE_FILES,
];

const decodeUrl = (url: string): string => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

const pinnedUrls = new Set(
  referenceFiles.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(DOWNLOAD_LINK)].map(([, url]) =>
      decodeUrl(url),
    ),
  ),
);

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
  if (pinnedUrls.has(assetUrl(file))) return keep();
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

const readReference = (file: string): string | null => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

const rewriteReferences = (renames: Map<string, string>): number => {
  if (!renames.size) return 0;
  const changes = referenceFiles.flatMap((file) => {
    const text = readReference(file);
    if (text === null) return [];
    const next = [...renames].reduce(
      (content, [from, to]) =>
        content.split(from).join(to).split(encodeURI(from)).join(encodeURI(to)),
      text,
    );
    return next === text ? [] : [{ file, text: next }];
  });
  if (!dryRun) {
    changes.forEach(({ file, text }) => {
      writeFileSync(file, text, 'utf8');
    });
  }
  return changes.length;
};

const files = walk(ASSET_ROOT).filter((file) =>
  RASTER.has(extname(file).toLowerCase()),
);

const results: Result[] = [];
for (const file of files) results.push(await optimise(file));

const renames = new Map(
  results
    .filter((result) => result.from !== result.to)
    .map((result) => [assetUrl(result.from), assetUrl(result.to)]),
);
const touched = rewriteReferences(renames);

const sortedResults = [...results].sort((a, b) => a.to.localeCompare(b.to));
const sizes: Record<string, [number, number]> = Object.fromEntries(
  sortedResults
    .filter((result) => result.width && result.height)
    .map((result) => [assetUrl(result.to), [result.width, result.height]]),
);
if (!dryRun) {
  writeFileSync(MANIFEST, `${JSON.stringify(sizes, null, 2)}\n`, 'utf8');
}

const before = sortedResults.reduce((sum, result) => sum + result.before, 0);
const after = sortedResults.reduce((sum, result) => sum + result.after, 0);
const saved = sortedResults
  .filter((result) => result.before !== result.after)
  .sort((a, b) => b.before - b.after - (a.before - a.after));

console.log(dryRun ? '— dry run, nothing written —\n' : '');
saved.slice(0, 10).forEach((result) => {
  console.log(
    `${mb(result.before).padStart(7)} → ${mb(result.after).padStart(6)} MB  ${relative(ASSET_ROOT, result.to)}`,
  );
});
console.log(
  `\n${results.length} 张：${mb(before)} MB → ${mb(after)} MB（省 ${(100 - (after / before) * 100).toFixed(1)}%）`,
);
console.log(`重命名 ${renames.size} 个文件，改写 ${touched} 个引用文件`);
console.log(`尺寸清单 ${MANIFEST}：${Object.keys(sizes).length} 条`);
