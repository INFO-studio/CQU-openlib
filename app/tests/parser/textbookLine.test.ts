import { createElement, Fragment, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { Mn } from '~/types/mdast';
import parser from '~/utils/parser';
import {
  remarkDisableIndentedCode,
  remarkFormatting,
  remarkIcon,
  removePosition,
} from '~/utils/remark';

const md = `## 资源

    * [教材](http://x) - :l-quote:\`传感器原理与实验教程\` - :l-user:\`何光宏\` - :l-printer:\`机械工业出版社\`
`;
const toAst = async (source: string): Promise<Mn> => {
  const processor = unified()
    .use(remarkDisableIndentedCode)
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkFormatting)
    .use(remarkIcon);
  const parsed = processor.parse(source);
  return removePosition((await processor.run(parsed)) as Mn);
};
const htmlOf = (node: ReactNode) => {
  return renderToStaticMarkup(createElement(Fragment, null, node));
};
describe('textbook list line (4-space indent)', () => {
  it('does not become an indented code block', async () => {
    const ast = await toAst(md);
    const json = JSON.stringify(ast);
    expect(json).not.toContain('"type":"code"');
    expect(json).toContain('"type":"list"');
    expect(json).toContain('"type":"icon"');
    expect(json).toContain('"type":"inlineCode"');
    expect(json).toContain('"value":"传感器原理与实验教程"');
  });
  it('renders icons and inline code without visible backticks', async () => {
    const html = htmlOf(parser(await toAst(md)));
    expect(html).not.toContain(':l-quote:');
    expect(html).not.toContain('`传感器');
    expect(html).toContain('传感器原理与实验教程');
    expect(html).toContain('<svg');
  });
});
