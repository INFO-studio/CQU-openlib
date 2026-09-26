import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import { createDocProcessor } from '~/utils/docProcessor';
import preprocess from '~/utils/preprocess';

const astOf = (path: string): MnRoot => {
  const processor = createDocProcessor();
  const markdown = readFileSync(path, 'utf8');
  return processor.runSync(
    processor.parse(preprocess(markdown)),
  ) as unknown as MnRoot;
};

describe('document components', () => {
  it('mounts the timetable before the official gallery in the bus page', () => {
    const path = 'public/doc/life/校车时刻表.md';
    const markdown = readFileSync(path, 'utf8');
    const ast = astOf(path);
    const children = ast.children ?? [];
    const componentIndex = children.findIndex(
      (node) => node.type === 'html' && node.value === '<BusTimeTable />',
    );
    const galleryIndex = children.findIndex(
      (node) => node.type === 'imageGallery',
    );

    expect(componentIndex).toBeGreaterThan(-1);
    expect(galleryIndex).toBeGreaterThan(componentIndex);
    expect(markdown.indexOf('生活_校车时刻表_004.webp')).toBeLessThan(
      markdown.indexOf('生活_校车时刻表_003.webp'),
    );
  });
});
