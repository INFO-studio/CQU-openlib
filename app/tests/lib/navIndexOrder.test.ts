import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { buildDocNavIndex } from '../../../vite/doc-nav-index';

/** Sibling pages the contributor index links to, in reading order. */
const linkedPaths = () => {
  const md = readFileSync(resolve('public/doc/contributor/index.md'), 'utf8');
  return [...md.matchAll(/]\(([^)\s/]+)\.md\)/g)].map(
    ([, name]) => `/contributor/${name}`,
  );
};

const contributorTree = () => {
  const { index } = buildDocNavIndex(resolve('public/doc'), resolve('.'));
  const section = index.sections.find((s) => s.id === 'contributor');
  return (section?.tree ?? []).map((node) => node.path);
};

describe('contributor sidebar order', () => {
  it('follows the link order of index.md', () => {
    const linked = linkedPaths();
    expect(linked.length).toBeGreaterThan(20);
    expect(contributorTree().slice(0, linked.length)).toEqual(linked);
  });

  it('keeps pages the index never links to, behind the listed ones', () => {
    const linked = new Set(linkedPaths());
    const paths = contributorTree();
    const unlisted = paths.filter((path) => !linked.has(path));
    expect(paths.slice(paths.length - unlisted.length)).toEqual(unlisted);
  });
});
