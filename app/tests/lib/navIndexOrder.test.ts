import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { buildDocNavIndex } from '../../../vite/doc-nav-index';

const fixtureRoot = resolve('app/tests/fixtures/nav-index');
const docRoot = resolve(fixtureRoot, 'doc');

const sectionTree = (id: string) => {
  const { index } = buildDocNavIndex(docRoot, fixtureRoot);
  return index.sections.find((section) => section.id === id)?.tree ?? [];
};

describe('sidebar index order', () => {
  it('follows index.md and puts unlisted pages after listed pages', () => {
    expect(sectionTree('contributor').map((node) => node.path)).toEqual([
      '/contributor/Zulu',
      '/contributor/Alpha',
      '/contributor/Beta',
    ]);
  });

  it('follows index.md recursively for nested folders', () => {
    const groups = sectionTree('life').find(
      (node) => node.path === '/life/Groups',
    );

    expect(groups?.children?.map((node) => node.path)).toEqual([
      '/life/Groups/Zulu',
      '/life/Groups/Alpha',
      '/life/Groups/Beta',
    ]);
  });

  it('follows index.md at the section root', () => {
    expect(sectionTree('life').map((node) => node.path)).toEqual([
      '/life/Second',
      '/life/Groups',
      '/life/First',
    ]);
  });

  it('places an app route where index.md links to it', () => {
    const tree = sectionTree('academic');

    expect(tree.map((node) => node.path)).toEqual([
      '/academic/Research',
      '/academic/graduation',
      '/academic/Campus',
    ]);
    expect(
      tree.find((node) => node.path === '/academic/graduation')?.title,
    ).toBe('毕业去向');
  });
});
