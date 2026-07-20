import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { entryMatches } from '~/lib/searchMatch';
import { buildDocNavIndex } from '../../../vite/doc-nav-index';

describe('search chunks', () => {
  it('splits courses by letter and keeps section chunks separate', () => {
    const { index, chunks } = buildDocNavIndex(
      resolve('public/doc'),
      resolve('.'),
    );
    expect(index.searchManifest).toBeTruthy();
    expect(chunks.some((c) => c.id === 'section-club')).toBe(true);
    expect(chunks.some((c) => c.id === 'course-G')).toBe(true);

    const g = chunks.find((c) => c.id === 'course-G');
    const gao = g?.entries.find((e) => e.path === '/course/高等数学');
    expect(gao?.codes).toContain('MATH10821');
    expect(entryMatches(gao!, 'MATH10821')).toBe(true);
  });
});
