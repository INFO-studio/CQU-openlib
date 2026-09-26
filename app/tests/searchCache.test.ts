import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import {
  readSearchCache,
  type SearchCache,
  searchCacheFile,
  writeSearchCache,
} from '../../vite/docSearch';

const withTemporaryRoot = <T>(run: (root: string) => T): T => {
  const root = mkdtempSync(join(tmpdir(), 'cqu-openlib-search-'));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe('search cache', () => {
  it('preserves generated Pagefind files and course code chunks', () => {
    withTemporaryRoot((root) => {
      const cache: SearchCache = {
        version: 1,
        fingerprint: 'fingerprint',
        recordCount: 2,
        files: [
          {
            path: 'pagefind.js',
            content: Uint8Array.from([1, 2, 3]),
          },
        ],
        courseCodeChunks: [['B', '{"B1":[]}']],
      };

      writeSearchCache(root, cache);

      expect(readSearchCache(root)).toEqual(cache);
    });
  });

  it('ignores an unreadable cache', () => {
    withTemporaryRoot((root) => {
      const file = searchCacheFile(root);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, 'not a serialized cache');

      expect(readSearchCache(root)).toBeNull();
    });
  });
});
