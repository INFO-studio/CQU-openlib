import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { Mn } from '~/types/mdast';
import parser from '~/utils/parser';
import { removePosition } from '~/utils/remark';

const toAst = async (md: string): Promise<Mn> => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm);
  const parsed = processor.parse(md);
  return removePosition((await processor.run(parsed)) as Mn);
};
const htmlOf = (node: ReactNode) => {
  return renderToStaticMarkup(createElement(Fragment, null, node));
};
describe('parser coverage for former unknown nodes', () => {
  it('renders fenced code', async () => {
    const html = htmlOf(parser(await toAst('```ts\nconst x = 1\n```\n')));
    expect(html).toContain('docs-codeblock');
    expect(html).toContain('docs-codeblock__copy');
    expect(html).toContain('<pre');
    expect(html).toContain('const x = 1');
    expect(html).not.toContain('unknown node');
    expect(html).not.toContain('```');
  });
  it('renders footnotes', async () => {
    const html = htmlOf(parser(await toAst('Hello[^1]\n\n[^1]: a note\n')));
    expect(html).toContain('docs-footnote-ref');
    expect(html).toContain('docs-footnote-def');
    expect(html).not.toContain('unknown node');
  });
  it('renders image and emphasis', async () => {
    const html = htmlOf(
      parser(await toAst('![alt](/x.png)\n\n*em* and ~~del~~\n')),
    );
    expect(html).toContain('<img');
    expect(html).toContain('<em>');
    expect(html).toContain('docs-strike');
    expect(html).not.toContain('unknown node');
  });
});
