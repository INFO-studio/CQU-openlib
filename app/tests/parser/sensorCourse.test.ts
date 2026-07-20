import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { Mn } from '~/types/mdast';
import parser from '~/utils/parser';
import preprocess from '~/utils/preprocess';
import {
  remarkDisableIndentedCode,
  remarkFormatting,
  remarkIcon,
  removePosition,
} from '~/utils/remark';

const htmlOf = (node: ReactNode) => {
  return renderToStaticMarkup(createElement(Fragment, null, node));
};
describe('传感器技术.md pipeline', () => {
  it('parses textbook meta as icons + inline code, not raw backticks', async () => {
    const raw = readFileSync(
      resolve('public/doc/course/传感器技术.md'),
      'utf8',
    );
    const processor = unified()
      .use(remarkDisableIndentedCode)
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .use(remarkFormatting)
      .use(remarkIcon);
    const ast = removePosition(
      (await processor.run(processor.parse(preprocess(raw)))) as Mn,
    );
    const html = htmlOf(parser(ast));
    expect(html).not.toContain(':l-quote:');
    expect(html).not.toContain(':l-user:');
    expect(html).not.toContain(':l-printer:');
    expect(html).not.toContain('`传感器');
    expect(html).toContain('传感器原理与实验教程');
    expect(html).toContain('<svg');
    expect(html).toContain('<code>');
  });
});
