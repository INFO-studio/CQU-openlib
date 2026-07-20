import { describe, expect, it } from 'vite-plus/test';
import { ADMONITION_END, ADMONITION_START } from '~/consts/placeholders';
import type { Mn, MnRoot } from '~/types/mdast';
import remarkAdmonition, {
  extractTitle,
} from '~/utils/remark/remarkAdmonition';

describe('extractTitle', () => {
  it('extracts quoted title text from admonition head', () => {
    expect(
      extractTitle([{ type: 'text', value: '!!! note "你好世界"' }]),
    ).toEqual([{ type: 'text', value: '你好世界' }]);
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
});
