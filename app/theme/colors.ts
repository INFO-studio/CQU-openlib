/**
 * Every color in the site. Light and dark sit side by side so neither can be
 * changed without seeing the other, and `satisfies` rejects a token missing
 * one. uno.config.ts turns this into both the `--c-*` custom properties and
 * the `text-ink` / `bg-error-soft` utilities.
 *
 * Values are OKLCH — lightness, chroma, hue. One color at several opacities
 * therefore repeats the same three numbers, which is what `brand` and `slate`
 * below are for. Each was converted from the sRGB palette that preceded it and
 * round-trips back to the same bytes.
 */

type Pair = { light: string; dark: string };

/** Brand blue, from CMYK C:100 M:70 Y:0 K:5 (was rgb(0, 73, 242)) */
const brand = '0.5006 0.2571 263.18';
/** What it lightens to once the page is dark */
const brandDark = '0.6946 0.1177 264.48';
/** The one slate every light-theme text and hairline comes from */
const slate = '0.2077 0.0398 265.75';
/** Its dark-theme mirror */
const slateDark = '0.9303 0.0187 265.98';

const color = {
  primary: { light: `oklch(${brand})`, dark: `oklch(${brandDark})` },
  primaryHover: {
    light: `oklch(${brand} / 0.88)`,
    dark: 'oklch(0.7406 0.1004 265)',
  },
  primarySoft: {
    light: `oklch(${brand} / 0.1)`,
    dark: `oklch(${brandDark} / 0.16)`,
  },
  primaryFaint: {
    light: `oklch(${brand} / 0.06)`,
    dark: `oklch(${brandDark} / 0.09)`,
  },
  /** Tail of the form-stack rail, where it fades out */
  primaryFade: {
    light: `oklch(${brand} / 0.15)`,
    dark: `oklch(${brandDark} / 0.15)`,
  },
  /** Hover wash. Same as primaryFaint today, free to diverge. */
  mist: { light: `oklch(${brand} / 0.06)`, dark: `oklch(${brandDark} / 0.09)` },

  ink: { light: `oklch(${slate} / 0.96)`, dark: `oklch(${slateDark} / 0.92)` },
  muted: {
    light: `oklch(${slate} / 0.55)`,
    dark: `oklch(${slateDark} / 0.52)`,
  },
  line: { light: `oklch(${slate} / 0.09)`, dark: `oklch(${slateDark} / 0.11)` },
  /** Section rule: louder than a hairline, quieter than ink (ink at 20%) */
  rule: {
    light: `oklch(${slate} / 0.192)`,
    dark: `oklch(${slateDark} / 0.184)`,
  },
  codeBg: {
    light: `oklch(${slate} / 0.05)`,
    dark: `oklch(${slateDark} / 0.06)`,
  },
  backdrop: { light: `oklch(${slate} / 0.4)`, dark: 'oklch(0 0 0 / 0.55)' },

  /** Opaque on purpose — icons must not let the surface bleed through */
  icon: {
    light: 'oklch(0.7123 0.0121 269.5)',
    dark: 'oklch(0.5276 0.0232 267.11)',
  },
  paper: {
    light: 'oklch(0.9792 0.0041 271.37)',
    dark: 'oklch(0.1677 0.0161 261.49)',
  },
  panel: { light: 'oklch(1 0 0)', dark: 'oklch(0.2103 0.0294 266.12)' },
  elev: { light: 'oklch(1 0 0)', dark: 'oklch(0.2521 0.0327 263.72)' },
  success: {
    light: 'oklch(0.5779 0.1328 150.51)',
    dark: 'oklch(0.689 0.1017 150.64)',
  },

  /** Form validation — solid pair so fg/bg never collapse */
  error: {
    light: 'oklch(0.465 0.147 24.94)',
    dark: 'oklch(0.8249 0.0701 18.68)',
  },
  errorSoft: {
    light: 'oklch(0.9478 0.023 17.56)',
    dark: 'oklch(0.2771 0.0425 8.25)',
  },
  errorLine: {
    light: 'oklch(0.7837 0.081 19.05)',
    dark: 'oklch(0.4339 0.0893 13.71)',
  },
} as const satisfies Record<string, Pair>;

/** Callout accents — muted on light paper, desaturated on dark */
const admonition = {
  note: {
    light: 'oklch(0.5636 0.1721 262.57)',
    dark: 'oklch(0.694 0.0833 255.65)',
  },
  abstract: {
    light: 'oklch(0.6151 0.1148 234.28)',
    dark: 'oklch(0.7 0.0759 228.46)',
  },
  info: {
    light: 'oklch(0.6339 0.0995 211.7)',
    dark: 'oklch(0.707 0.0699 208.98)',
  },
  tip: {
    light: 'oklch(0.6168 0.1086 170.69)',
    dark: 'oklch(0.7164 0.0855 168.76)',
  },
  success: color.success,
  question: {
    light: 'oklch(0.6299 0.1463 130.44)',
    dark: 'oklch(0.7236 0.0975 123.06)',
  },
  warning: {
    light: 'oklch(0.6627 0.1341 73)',
    dark: 'oklch(0.7262 0.0829 77)',
  },
  failure: {
    light: 'oklch(0.5741 0.1567 23.42)',
    dark: 'oklch(0.6578 0.0929 19.86)',
  },
  danger: {
    light: 'oklch(0.5525 0.1717 18.31)',
    dark: 'oklch(0.6409 0.1065 12.89)',
  },
  bug: {
    light: 'oklch(0.5555 0.1417 354.53)',
    dark: 'oklch(0.6479 0.0822 347.28)',
  },
  example: {
    light: 'oklch(0.5289 0.1286 289.46)',
    dark: 'oklch(0.6557 0.0717 296.8)',
  },
  quote: {
    light: 'oklch(0.596 0.0177 266.2)',
    dark: 'oklch(0.6523 0.0192 264.43)',
  },
} as const satisfies Record<string, Pair>;

export type AdmonitionTone = keyof typeof admonition;

const varName = (prefix: string, token: string) =>
  `${prefix}${token.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`;

const entries = (palette: Record<string, Pair>, prefix: string) =>
  Object.entries(palette).map(
    ([token, pair]) => [varName(prefix, token), pair] as const,
  );

const all = [
  ...entries(color, '--c-'),
  ...entries(admonition, '--admonition-'),
];

const refs = <T extends string>(palette: Record<T, Pair>, prefix: string) =>
  Object.fromEntries(
    Object.keys(palette).map((t) => [t, `var(${varName(prefix, t)})`]),
  ) as Record<T, string>;

export const colors = refs(color, '--c-');
export const admonitionColors = refs(admonition, '--admonition-');

/** Read by the theme variable test. */
export const paletteVarNames = all.map(([name]) => name);

const block = (selector: string, mode: keyof Pair) =>
  `${selector} {\n${all.map(([name, pair]) => `  ${name}: ${pair[mode]};`).join('\n')}\n}`;

/** `.theme-dark` is an opt-in island for surfaces that stay dark either way. */
export const paletteCss = [
  block(':root', 'light'),
  block('html[data-theme="dark"],\n.theme-dark', 'dark'),
].join('\n\n');
