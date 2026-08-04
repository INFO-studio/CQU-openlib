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

const lifeTree = () => {
  const { index } = buildDocNavIndex(resolve('public/doc'), resolve('.'));
  return index.sections.find((section) => section.id === 'life')?.tree ?? [];
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

describe('life sidebar order', () => {
  it('follows life/index.md at the section root', () => {
    expect(
      lifeTree()
        .map((node) => node.path)
        .slice(0, 6),
    ).toEqual([
      '/life/谨防诈骗',
      '/life/学生卡',
      '/life/校园网',
      '/life/校车时刻表',
      '/life/吃饭！活着就是为了吃饭！',
      '/life/学习之余也要生活不是嘛',
    ]);
  });

  it('recursively follows 学生团体/index.md for its submenu', () => {
    const groups = lifeTree().find((node) => node.path === '/life/学生团体');
    expect(groups?.children?.map((node) => node.path)).toEqual([
      '/life/学生团体/铳带',
      '/life/学生团体/电竞同好会',
      '/life/学生团体/东方Club',
      '/life/学生团体/饭协',
      '/life/学生团体/喵呜社',
      '/life/学生团体/EF邦多利马群',
      '/life/学生团体/EF库洛游戏交流群',
      '/life/学生团体/Paradox同好会',
      '/life/学生团体/CQUcraft',
    ]);
  });
});
