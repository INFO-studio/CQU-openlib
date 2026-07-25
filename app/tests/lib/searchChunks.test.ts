import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import type { SidebarNode } from '~/lib/nav';
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

  it('keeps changelog days out of search but leaves them in the sidebar', () => {
    const { index, chunks } = buildDocNavIndex(
      resolve('public/doc'),
      resolve('.'),
    );
    const entries = chunks.flatMap((c) => c.entries);
    const changelog = entries.filter((e) => e.path.includes('/更新日志'));
    expect(changelog.map((e) => e.path)).toEqual(['/sundry/更新日志']);

    const sundry = index.sections.find((s) => s.id === 'sundry');
    const leaves = (nodes: SidebarNode[]): SidebarNode[] =>
      nodes.flatMap((n) => (n.children?.length ? leaves(n.children) : [n]));
    expect(
      leaves(sundry?.tree ?? []).filter((n) => n.path.includes('/更新日志'))
        .length,
    ).toBeGreaterThan(100);
  });
});
