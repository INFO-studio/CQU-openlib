import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { paletteVarNames } from '~/theme/colors';
import { layoutVarNames } from '~/theme/layout';

/**
 * `theme.colors` and `theme.spacing` protect the utility classes: misspell
 * `text-inkk` and the class simply isn't generated, which the build surfaces.
 * The handful of places that can't use a utility — composite shadows,
 * gradients, calc() — still spell the custom property out by hand, and a typo
 * there is silent: the browser drops the declaration and the element keeps
 * whatever it inherited. This test is what makes those spellings checked.
 */

const KNOWN = new Set([...paletteVarNames, ...layoutVarNames]);

/** Only the prefixes generated from TS. Font stacks stay hand-written in CSS. */
const REFERENCE = /var\(\s*(--(?:c|admonition|layout)-[a-z0-9-]+)/g;

const SOURCES = new Set(['.ts', '.tsx', '.css']);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return SOURCES.has(extname(path)) ? [path] : [];
  });

const files = [...walk(resolve('app')), resolve('uno.config.ts')];

describe('theme custom properties', () => {
  it('scans a meaningful number of files', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('only references properties the theme actually defines', () => {
    const unknown: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const [, name] of source.matchAll(REFERENCE)) {
        if (!KNOWN.has(name)) unknown.push(`${file}: ${name}`);
      }
    }

    expect(unknown).toEqual([]);
  });

  it('derives every property name from a token', () => {
    expect(paletteVarNames).toContain('--c-primary-faint');
    expect(paletteVarNames).toContain('--c-error-soft');
    expect(paletteVarNames).toContain('--admonition-note');
    expect(layoutVarNames).toContain('--layout-header');
  });
});
