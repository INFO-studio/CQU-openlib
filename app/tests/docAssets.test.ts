import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

const DOC_ROOT = resolve('public/doc');
const PUBLIC_ROOT = resolve('public');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });

describe('document asset boundaries', () => {
  it('keeps public/doc limited to Markdown pages', () => {
    const nonMarkdown = walk(DOC_ROOT)
      .filter((file) => !/^\.mdx?$/i.test(extname(file)))
      .map((file) => relative(DOC_ROOT, file));

    expect(nonMarkdown).toEqual([]);
  });

  it('keeps every /assets/doc reference backed by a public file', () => {
    const assetUrl =
      /\/assets\/doc\/[^)"<>\s]+?\.(?:webp|png|jpe?g|gif|svg|pdf)/gi;
    const missing = new Set<string>();

    for (const file of walk(DOC_ROOT).filter((path) => /\.mdx?$/i.test(path))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(assetUrl)) {
        const url = match[0];
        let decoded = url;
        try {
          decoded = decodeURI(url);
        } catch {
          // A malformed URL is missing by definition and stays visible below.
        }
        if (!existsSync(join(PUBLIC_ROOT, decoded.slice(1)))) missing.add(url);
      }
    }

    expect([...missing].sort()).toEqual([]);
  });
});
