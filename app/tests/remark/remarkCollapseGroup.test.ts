import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { MnCollapseGroup, MnRoot } from '~/types/mdast';
import parser from '~/utils/parser';
import preprocess from '~/utils/preprocess';
import {
  remarkCollapseGroup,
  remarkContentTabs,
  remarkDisableIndentedCode,
  removePosition,
} from '~/utils/remark';

const toAst = async (source: string): Promise<MnRoot> => {
  const processor = unified()
    .use(remarkDisableIndentedCode)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkContentTabs)
    .use(remarkCollapseGroup);

  return removePosition(
    (await processor.run(processor.parse(preprocess(source)))) as MnRoot,
  ) as MnRoot;
};

describe('remarkCollapseGroup', () => {
  it('builds one group from consecutive titled items', async () => {
    const root = await toAst(
      [
        '^^^ **学生卡**必须提前办？',
        '    不用，**不要付款**。',
        '',
        '^^^ 教材必须统一买？',
        '    - 等辅导员通知',
        '    - 不要私下转账',
      ].join('\n'),
    );

    const group = root.children?.[0] as MnCollapseGroup;
    expect(group.type).toBe('collapseGroup');
    expect(group.items).toHaveLength(2);
    expect(group.items[0]?.title).toEqual([
      {
        type: 'strong',
        children: [{ type: 'text', value: '学生卡' }],
      },
      { type: 'text', value: '必须提前办？' },
    ]);
    expect(JSON.stringify(group.items[0]?.children)).toContain('不要付款');
    expect(JSON.stringify(group.items[1]?.children)).toContain('"type":"list"');
  });

  it('converts a collapse group nested inside a tab', async () => {
    const root = await toAst(
      ['=== "问答"', '    ^^^ 能买吗？', '        不能。'].join('\n'),
    );
    const tabs = root.children?.[0];
    expect(tabs?.type).toBe('tabs');
    if (tabs?.type !== 'tabs') throw new Error('expected tabs');
    expect(tabs.items[0]?.children[0]?.type).toBe('collapseGroup');
  });

  it('renders accessible collapse triggers', async () => {
    const root = await toAst(
      ['^^^ 第一项', '    正文一', '^^^ 第二项', '    正文二'].join('\n'),
    );
    const html = renderToStaticMarkup(
      createElement(Fragment, null, parser(root)),
    );
    expect(html).toContain('cquol-collapse-group');
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('aria-expanded="false"');
  });
});
