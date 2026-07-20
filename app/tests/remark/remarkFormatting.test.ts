import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import remarkFormatting from '~/utils/remark/remarkFormatting';

describe('remarkFormatting', () => {
  it('parses highlight and strikethrough markers in text', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'a{==hi==}b{--bye--}c' }],
        },
      ],
    };

    remarkFormatting()(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'a' },
        {
          type: 'highlight',
          children: [{ type: 'text', value: 'hi' }],
        },
        { type: 'text', value: 'b' },
        {
          type: 'strikethrough',
          children: [{ type: 'text', value: 'bye' }],
        },
        { type: 'text', value: 'c' },
      ],
    });
  });

  it('leaves plain text unchanged', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'plain' }],
        },
      ],
    };

    remarkFormatting()(tree);
    expect(tree.children?.[0]).toMatchObject({
      children: [{ type: 'text', value: 'plain' }],
    });
  });
});
