import { describe, expect, it } from 'vite-plus/test';
import type { Mn, MnRoot } from '~/types/mdast';
import {
  ADMONITION_END,
  ADMONITION_START,
} from '~/utils/preprocess/placeholders';
import remarkAdmonition, {
  extractTitle,
} from '~/utils/remark/remarkAdmonition';

describe('extractTitle', () => {
  it('extracts quoted title text from admonition head', () => {
    expect(
      extractTitle([{ type: 'text', value: '!!! note "你好世界"' }]),
    ).toEqual([{ type: 'text', value: '你好世界' }]);
  });

  it('extracts titles from ??? / ???+ heads', () => {
    expect(
      extractTitle([{ type: 'text', value: '??? example "样例"' }]),
    ).toEqual([{ type: 'text', value: '样例' }]);
    expect(extractTitle([{ type: 'text', value: '???+ tip "展开"' }])).toEqual([
      { type: 'text', value: '展开' },
    ]);
  });

  it('returns empty when there is no quoted title', () => {
    expect(extractTitle([{ type: 'text', value: '!!! note' }])).toEqual([]);
    expect(extractTitle([])).toEqual([]);
  });

  it('keeps inline nodes inside quotes but drops body after the closer', () => {
    const nodes: Mn[] = [
      { type: 'text', value: '!!! note "' },
      { type: 'icon', icon: 'l-arrow-right' },
      { type: 'text', value: '标题"' },
      { type: 'break' },
      { type: 'inlineCode', value: 'not-title' },
    ];
    expect(extractTitle(nodes)).toEqual([
      { type: 'icon', icon: 'l-arrow-right' },
      { type: 'text', value: '标题' },
    ]);
  });

  it('keeps a trailing link immediately before the closing quote', () => {
    const link: Mn = {
      type: 'link',
      url: '/form/group',
      title: null,
      children: [{ type: 'text', value: '学生团体收录表' }],
    };
    const nodes: Mn[] = [
      {
        type: 'text',
        value: '!!! info "如果您想要被收录，请填写',
      },
      link,
      { type: 'text', value: '"' },
    ];
    expect(extractTitle(nodes)).toEqual([
      { type: 'text', value: '如果您想要被收录，请填写' },
      link,
    ]);
  });

  it('does not mutate the source AST when trimming quotes', () => {
    const nodes: Mn[] = [{ type: 'text', value: '!!! note "你好世界"' }];
    extractTitle(nodes);
    expect(nodes[0]).toEqual({ type: 'text', value: '!!! note "你好世界"' });
  });
});

describe('remarkAdmonition', () => {
  it('collapses sentinel-wrapped paragraphs into admonition nodes', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        { type: 'html', value: ADMONITION_START },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '!!! tip "标题"' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'body' }],
        },
        { type: 'html', value: ADMONITION_END },
      ],
    };

    remarkAdmonition()(tree);

    expect(tree.children).toEqual([
      {
        type: 'admonition',
        admonitionType: 'tip',
        title: [{ type: 'text', value: '标题' }],
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'body' }],
          },
        ],
      },
    ]);
  });

  it('marks ??? as collapse closed and ???+ as open', () => {
    const closed: MnRoot = {
      type: 'root',
      children: [
        { type: 'html', value: ADMONITION_START },
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: '??? example "化学反应焓变的测定"' },
          ],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'code' }],
        },
        { type: 'html', value: ADMONITION_END },
      ],
    };
    remarkAdmonition()(closed);
    expect(closed.children).toEqual([
      {
        type: 'admonition',
        admonitionType: 'example',
        collapse: 'closed',
        title: [{ type: 'text', value: '化学反应焓变的测定' }],
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'code' }],
          },
        ],
      },
    ]);

    const opened: MnRoot = {
      type: 'root',
      children: [
        { type: 'html', value: ADMONITION_START },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '???+ note "PTA"' }],
        },
        { type: 'html', value: ADMONITION_END },
      ],
    };
    remarkAdmonition()(opened);
    expect(opened.children?.[0]).toMatchObject({
      type: 'admonition',
      admonitionType: 'note',
      collapse: 'open',
      title: [{ type: 'text', value: 'PTA' }],
    });
  });

  it('collapses one nested in a list item, indent and all', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'list',
          ordered: false,
          start: null,
          spread: true,
          children: [
            {
              type: 'listItem',
              spread: true,
              checked: null,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: '条目' }],
                },
                // The list marker eats part of the indent, so the placeholder
                // arrives with whatever is left over.
                { type: 'html', value: `  ${ADMONITION_START}` },
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: '!!! warning "注意"' }],
                },
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'body' }],
                },
                { type: 'html', value: `  ${ADMONITION_END}` },
              ],
            },
          ],
        },
      ],
    };

    remarkAdmonition()(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'list',
      children: [
        {
          type: 'listItem',
          children: [
            { type: 'paragraph', children: [{ value: '条目' }] },
            {
              type: 'admonition',
              admonitionType: 'warning',
              title: [{ type: 'text', value: '注意' }],
              children: [{ type: 'paragraph', children: [{ value: 'body' }] }],
            },
          ],
        },
      ],
    });
  });
});
