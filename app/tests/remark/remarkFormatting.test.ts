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

  it('reaches list items nested inside a content tab', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'tabs',
          items: [
            {
              title: [{ type: 'text', value: '{==标题==}' }],
              children: [
                {
                  type: 'list',
                  ordered: false,
                  start: null,
                  spread: false,
                  children: [
                    {
                      type: 'listItem',
                      spread: false,
                      checked: null,
                      children: [
                        {
                          type: 'paragraph',
                          children: [{ type: 'text', value: '{==正文==}' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    remarkFormatting()(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'tabs',
      items: [
        {
          title: [{ type: 'highlight', children: [{ value: '标题' }] }],
          children: [
            {
              type: 'list',
              children: [
                {
                  children: [
                    {
                      children: [
                        { type: 'highlight', children: [{ value: '正文' }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('matches across the soft break of a wrapped paragraph', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '前 {==高\n亮==} 后' }],
        },
      ],
    };

    remarkFormatting()(tree);

    expect(tree.children?.[0]).toMatchObject({
      children: [
        { type: 'text', value: '前 ' },
        { type: 'highlight', children: [{ type: 'text', value: '高\n亮' }] },
        { type: 'text', value: ' 后' },
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
