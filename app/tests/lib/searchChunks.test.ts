import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import type { SidebarNode } from '~/lib/nav';
import { buildDocNavIndex } from '../../../vite/docNavIndex';

describe('search documents', () => {
  it('includes course codes and app pages without duplicating URLs', () => {
    const { documents } = buildDocNavIndex(resolve('public/doc'), resolve('.'));
    expect(
      documents.find((entry) => entry.path === '/course/高等数学')?.codes,
    ).toContain('MATH10821');
    expect(
      documents.some((entry) => entry.path === '/academic/graduation'),
    ).toBe(true);
    expect(new Set(documents.map((entry) => entry.path)).size).toBe(
      documents.length,
    );
  });

  it('keeps changelog days out of search but leaves them in the sidebar', () => {
    const { index, documents } = buildDocNavIndex(
      resolve('public/doc'),
      resolve('.'),
    );
    expect(
      documents
        .filter((entry) => entry.path.includes('/更新日志'))
        .map((entry) => entry.path),
    ).toEqual(['/sundry/更新日志']);
    const sundry = index.sections.find((section) => section.id === 'sundry');
    const leaves = (nodes: SidebarNode[]): SidebarNode[] =>
      nodes.flatMap((node) =>
        node.children?.length ? leaves(node.children) : [node],
      );
    expect(
      leaves(sundry?.tree ?? []).filter((node) =>
        node.path.includes('/更新日志'),
      ).length,
    ).toBeGreaterThan(100);
  });
});
