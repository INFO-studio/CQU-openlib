import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import remarkIcon from '~/utils/remark/remarkIcon';

describe('remarkIcon', () => {
  it('splits text into lucide icon nodes', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'go :l-arrow-right: next' }],
        },
      ],
    };

    remarkIcon()(tree);

    expect(tree.children?.[0]).toMatchObject({
      children: [
        { type: 'text', value: 'go ' },
        { type: 'icon', icon: 'l-arrow-right' },
        { type: 'text', value: ' next' },
      ],
    });
  });

  it('parses multiple icons in one text node', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: ':l-book::l-tag:' }],
        },
      ],
    };

    remarkIcon()(tree);
    expect(tree.children?.[0]).toMatchObject({
      children: [
        { type: 'icon', icon: 'l-book' },
        { type: 'icon', icon: 'l-tag' },
      ],
    });
  });
});
