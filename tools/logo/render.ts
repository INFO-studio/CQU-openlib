import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Font, Path } from 'opentype.js';
import { match } from 'ts-pattern';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js') as {
  parse: (buffer: ArrayBuffer) => Font;
};

export const LOGO_VIEWBOX = 2000;
export const LOGO_CX = 1000;
export const LOGO_CY = 1000;
export const LOGO_DISK_R = 999;

export const LAYOUT = {
  cquCap: { top: 510, bottom: 912, width: 1242 },
  cquFull: { top: 510, bottom: 997 },
  openlib: { top: 1114, bottom: 1488, width: 1242 },
  openlibX: { top: 1211, bottom: 1402 },
} as const;

export type LogoPolarity = 'on-light' | 'on-dark';
export type LogoColors = { disk: string; ink: string };
export const LOGO_COLORS: Record<LogoPolarity, LogoColors> = {
  'on-light': { disk: '#d4d4d8', ink: '#000000' },
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

const mergeBb = (paths: Path[]): Placed['bb'] =>
  paths
    .map((path) => path.getBoundingBox())
    .reduce((a, b) => ({
      x1: Math.min(a.x1, b.x1),
      y1: Math.min(a.y1, b.y1),
      x2: Math.max(a.x2, b.x2),
      y2: Math.max(a.y2, b.y2),
    }));

// opentype.js toPathData() emits NaN on some Q shorthand edges.
const pathToD = (path: Path, decimals = 3): string => {
  const round = (value: number) => {
    if (!Number.isFinite(value))
      throw new Error(`non-finite path coord: ${value}`);
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };
  return path.commands
    .map((command) =>
      match(command)
        .with({ type: 'M' }, (c) => `M${round(c.x)} ${round(c.y)}`)
        .with({ type: 'L' }, (c) => `L${round(c.x)} ${round(c.y)}`)
        .with(
          { type: 'Q' },
          (c) => `Q${round(c.x1)} ${round(c.y1)} ${round(c.x)} ${round(c.y)}`,
        )
        .with(
          { type: 'C' },
          (c) =>
            `C${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} ${round(c.x)} ${round(c.y)}`,
        )
        .with({ type: 'Z' }, () => 'Z')
        .otherwise(() => ''),
    )
    .join('');
};

const placeLine = (
  font: Font,
  text: string,
  size: number,
  baseline: number,
  tracking: number,
  centerX: number,
): Placed => {
  const glyphs = font.stringToGlyphs(text);
  const advances = glyphs.map(
    (glyph) => (glyph.advanceWidth * size) / font.unitsPerEm,
  );
  const total =
    advances.reduce((a, b) => a + b, 0) + tracking * (glyphs.length - 1);
  // Accumulate offsets in order to preserve the original floating-point geometry.
  const offsets = advances.reduce<number[]>(
    (positions, advance) => {
      positions.push(positions[positions.length - 1]! + advance + tracking);
      return positions;
    },
    [centerX - total / 2],
  );
  const paths = glyphs.map((glyph, index) =>
    glyph.getPath(offsets[index]!, baseline, size),
  );
  return { d: paths.map((path) => pathToD(path)).join(''), bb: mergeBb(paths) };
};

const fitSizeToHeight = (
  font: Font,
  text: string,
  targetHeight: number,
): number => {
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
};

const fitTrackingToWidth = (
  font: Font,
  text: string,
  size: number,
  baseline: number,
  targetWidth: number,
): number => {
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
};

const layoutLine = (
  font: Font,
  text: string,
  sizeProbe: string,
  band: { top: number; bottom: number; width?: number },
  lock: 'top' | 'bottom' = 'top',
): Placed => {
  const targetH = band.bottom - band.top;
  const size = fitSizeToHeight(font, sizeProbe, targetH);
  const raw = font.getPath(sizeProbe, 0, 0, size).getBoundingBox();
  const baseline = lock === 'top' ? band.top - raw.y1 : band.bottom - raw.y2;
  const tracking =
    band.width == null
      ? 0
      : fitTrackingToWidth(font, text, size, baseline, band.width);
  return placeLine(font, text, size, baseline, tracking, LOGO_CX);
};

export const renderLogoSvg = (options: RenderLogoOptions): string => {
  const colors = { ...LOGO_COLORS[options.polarity], ...options.colors };
  const cqu = layoutLine(options.font, 'CQU', 'C', LAYOUT.cquCap, 'bottom');
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
};

export const defaultFontPath = (): string =>
  join(
    dirname(fileURLToPath(import.meta.url)),
    'fonts/AbhayaLibre-Regular.ttf',
  );

export const loadLogoFont = (fontPath: string): Font => {
  const buf = readFileSync(fontPath);
  return opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
};
