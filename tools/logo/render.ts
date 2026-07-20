/**
 * Programmatic CQU-openlib mark.
 *
 * Geometry locked to the original raster (2000×1999 → square 2000 viewBox):
 * - disk ≈ fills canvas (r=999), outside fully transparent
 * - "CQU" ink band ≈ y 510–997, width 1242, centered at x=1000
 * - "openlib" ink band ≈ y 1114–1488, same width, same center
 *
 * Typeface: Abhaya Libre Regular (OFL).
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Font, Path } from 'opentype.js';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js') as {
  parse: (buffer: ArrayBuffer) => Font;
};

export const LOGO_VIEWBOX = 2000;
export const LOGO_CX = 1000;
export const LOGO_CY = 1000;
/** Original mid-row radius ≈ 998.65 on 2000×1999; use 999 on square canvas. */
export const LOGO_DISK_R = 999;

/** Ink-band targets measured from public/doc/assets original. */
export const LAYOUT = {
  /** Cap box for C/U (excludes Q descender). */
  cquCap: { top: 510, bottom: 912, width: 1242 },
  /** Full CQU ink including Q tail — used only as soft constraint. */
  cquFull: { top: 510, bottom: 997 },
  openlib: { top: 1114, bottom: 1488, width: 1242 },
  /** x-height band for o/e/n. */
  openlibX: { top: 1211, bottom: 1402 },
} as const;

export type LogoPolarity = 'on-light' | 'on-dark';

export type LogoColors = {
  disk: string;
  ink: string;
};

/** Named by the theme chrome they sit on. */
export const LOGO_COLORS: Record<LogoPolarity, LogoColors> = {
  /** Light chrome → light gray disk, pure black type */
  'on-light': { disk: '#d4d4d8', ink: '#000000' },
  /** Dark chrome → white disk, black type */
  'on-dark': { disk: '#FFFFFF', ink: '#000000' },
};

export type RenderLogoOptions = {
  polarity: LogoPolarity;
  colors?: Partial<LogoColors>;
  font: Font;
};

type Placed = {
  d: string;
  bb: { x1: number; y1: number; x2: number; y2: number };
};

function mergeBb(paths: Path[]): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  return paths
    .map((p) => p.getBoundingBox())
    .reduce((a, b) => ({
      x1: Math.min(a.x1, b.x1),
      y1: Math.min(a.y1, b.y1),
      x2: Math.max(a.x2, b.x2),
      y2: Math.max(a.y2, b.y2),
    }));
}

/** Avoid opentype.js toPathData() which emits NaN on some Q shorthand edges. */
function pathToD(path: Path, decimals = 3): string {
  const r = (n: number) => {
    if (!Number.isFinite(n)) {
      throw new Error(`non-finite path coord: ${n}`);
    }
    const m = 10 ** decimals;
    return Math.round(n * m) / m;
  };
  let d = '';
  for (const c of path.commands) {
    switch (c.type) {
      case 'M':
        d += `M${r(c.x)} ${r(c.y)}`;
        break;
      case 'L':
        d += `L${r(c.x)} ${r(c.y)}`;
        break;
      case 'Q':
        d += `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
        break;
      case 'C':
        d += `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
        break;
      case 'Z':
        d += 'Z';
        break;
      default:
        break;
    }
  }
  return d;
}

function placeLine(
  font: Font,
  text: string,
  size: number,
  baseline: number,
  tracking: number,
  centerX: number,
): Placed {
  const glyphs = font.stringToGlyphs(text);
  const advances = glyphs.map((g) => (g.advanceWidth * size) / font.unitsPerEm);
  const total =
    advances.reduce((a, b) => a + b, 0) + tracking * (glyphs.length - 1);
  let x = centerX - total / 2;
  const paths: Path[] = [];
  for (let i = 0; i < glyphs.length; i++) {
    paths.push(glyphs[i].getPath(x, baseline, size));
    x += advances[i] + tracking;
  }
  return {
    d: paths.map((p) => pathToD(p)).join(''),
    bb: mergeBb(paths),
  };
}

function fitSizeToHeight(
  font: Font,
  text: string,
  targetHeight: number,
): number {
  let lo = 40;
  let hi = 900;
  let size = 200;
  for (let i = 0; i < 28; i++) {
    size = (lo + hi) / 2;
    const bb = font.getPath(text, 0, 0, size).getBoundingBox();
    if (bb.y2 - bb.y1 < targetHeight) lo = size;
    else hi = size;
  }
  return size;
}

function fitTrackingToWidth(
  font: Font,
  text: string,
  size: number,
  baseline: number,
  targetWidth: number,
): number {
  let lo = -48;
  let hi = 48;
  let track = 0;
  for (let i = 0; i < 24; i++) {
    track = (lo + hi) / 2;
    const { bb } = placeLine(font, text, size, baseline, track, LOGO_CX);
    if (bb.x2 - bb.x1 < targetWidth) lo = track;
    else hi = track;
  }
  return track;
}

function layoutLine(
  font: Font,
  text: string,
  sizeProbe: string,
  band: { top: number; bottom: number; width?: number },
  lock: 'top' | 'bottom' = 'top',
): Placed {
  const targetH = band.bottom - band.top;
  const size = fitSizeToHeight(font, sizeProbe, targetH);
  const raw = font.getPath(sizeProbe, 0, 0, size).getBoundingBox();
  const baseline = lock === 'top' ? band.top - raw.y1 : band.bottom - raw.y2;
  const tracking =
    band.width == null
      ? 0
      : fitTrackingToWidth(font, text, size, baseline, band.width);
  return placeLine(font, text, size, baseline, tracking, LOGO_CX);
}

export function renderLogoSvg(options: RenderLogoOptions): string {
  const colors = { ...LOGO_COLORS[options.polarity], ...options.colors };
  // Cap-height + original ink width for CQU.
  const cqu = layoutLine(options.font, 'CQU', 'C', LAYOUT.cquCap, 'bottom');
  // x-height for openlib; natural tracking (forced equal-width looked cramped).
  const openlib = layoutLine(
    options.font,
    'openlib',
    'o',
    LAYOUT.openlibX,
    'bottom',
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}" fill="none">`,
    `  <title>CQU openlib</title>`,
    `  <circle cx="${LOGO_CX}" cy="${LOGO_CY}" r="${LOGO_DISK_R}" fill="${colors.disk}"/>`,
    `  <path fill="${colors.ink}" d="${cqu.d}"/>`,
    `  <path fill="${colors.ink}" d="${openlib.d}"/>`,
    `</svg>`,
    '',
  ].join('\n');
}

export function defaultFontPath(): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    'fonts/AbhayaLibre-Regular.ttf',
  );
}

export function loadLogoFont(fontPath: string): Font {
  const buf = readFileSync(fontPath);
  return opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
}
