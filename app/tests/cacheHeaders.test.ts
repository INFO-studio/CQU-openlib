import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

const headers = readFileSync('public/_headers', 'utf8');

const ruleFor = (path: string): string => {
  const blocks = headers.split(/\n(?=\/)/);
  return blocks.find((block) => block.startsWith(`${path}\n`)) ?? '';
};

describe('Pagefind cache policy', () => {
  it('revalidates fixed runtime entrypoints after one day', () => {
    [
      '/search/pagefind/pagefind-entry.json',
      '/search/pagefind/pagefind.js',
      '/search/pagefind/pagefind-worker.js',
      '/search/pagefind/wasm.unknown.pagefind',
    ].forEach((path) => {
      expect(ruleFor(path)).toContain(
        'Cache-Control: public, max-age=86400, must-revalidate',
      );
    });
  });

  it('keeps content-addressed index assets immutable', () => {
    expect(ruleFor('/search/pagefind/fragment/*')).toContain(
      'max-age=31536000, immutable',
    );
    expect(ruleFor('/search/pagefind/index/*')).toContain(
      'max-age=31536000, immutable',
    );
  });
});
