import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { Mn, MnTabs } from '~/types/mdast';
import preprocess from '~/utils/preprocess';
import {
  remarkContentTabs,
  remarkDisableIndentedCode,
  remarkFormatting,
  remarkIcon,
  removePosition,
} from '~/utils/remark';

const toAst = async (source: string): Promise<Mn> => {
  const processor = unified()
    .use(remarkDisableIndentedCode)
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkContentTabs)
    .use(remarkFormatting)
    .use(remarkIcon);
  return removePosition(
    (await processor.run(processor.parse(preprocess(source)))) as Mn,
  );
};
const firstTabs = (node: Mn): MnTabs | null => {
  if (node.type === 'tabs') return node;
  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = firstTabs(child as Mn);
      if (found) return found;
    }
  }
  return null;
};
const tabTitleText = (tabs: MnTabs, index: number): string => {
  return (tabs.items[index]?.title ?? [])
    .map((n) => (n.type === 'text' ? (n.value ?? '') : ''))
    .join('');
};
describe('nested content tabs', () => {
  it('preserves 3-level nesting from indent', async () => {
    const md = [
      '=== "外"',
      '    === "中"',
      '        === "内"',
      '            hello',
      '',
    ].join('\n');
    const ast = await toAst(md);
    const outer = firstTabs(ast);
    expect(outer).toBeTruthy();
    expect(tabTitleText(outer!, 0)).toContain('外');
    const mid = firstTabs({
      type: 'root',
      children: outer!.items[0]!.children,
    } as Mn);
    expect(mid).toBeTruthy();
    expect(tabTitleText(mid!, 0)).toContain('中');
    const inner = firstTabs({
      type: 'root',
      children: mid!.items[0]!.children,
    } as Mn);
    expect(inner).toBeTruthy();
    expect(tabTitleText(inner!, 0)).toContain('内');
  });
  it('parses 重庆大学视觉形象 nested tabs', async () => {
    const raw = readFileSync(
      resolve('public/doc/academic/重庆大学视觉形象.md'),
      'utf8',
    );
    const ast = await toAst(raw);
    const outer = firstTabs(ast);
    expect(outer).toBeTruthy();
    const titles = (outer?.items ?? []).map((_, i) => tabTitleText(outer!, i));
    expect(titles.some((t) => t.includes('校徽'))).toBe(true);
    expect(titles.some((t) => t.includes('中文校名'))).toBe(true);
    expect(titles.some((t) => t.includes('组合'))).toBe(true);
    const badge = outer!.items.find((item) =>
      item.title.some((n) => n.type === 'text' && n.value?.includes('校徽')),
    );
    expect(badge).toBeTruthy();
    const nested = firstTabs({
      type: 'root',
      children: badge!.children,
    } as Mn);
    expect(nested).toBeTruthy();
    expect(nested!.items.length).toBeGreaterThanOrEqual(2);
    const nestedTitles = nested!.items.map((_, i) => tabTitleText(nested!, i));
    expect(nestedTitles.some((t) => t.includes('蓝色'))).toBe(true);
    expect(nestedTitles.some((t) => t.includes('黑色'))).toBe(true);
  });
});
