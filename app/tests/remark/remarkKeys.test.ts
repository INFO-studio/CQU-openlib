import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import remarkKeys from '~/utils/remark/remarkKeys';

describe('remarkKeys', () => {
  it('parses pymdownx ++ctrl+f++ chords', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '按 ++ctrl+f++ 查找' }],
        },
      ],
    };

    remarkKeys()(tree);

    expect(tree.children?.[0]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: '按 ' },
        {
          type: 'kbd',
          keys: [
            { name: 'ctrl', label: 'Ctrl' },
            { name: 'f', label: 'F' },
          ],
        },
        { type: 'text', value: ' 查找' },
      ],
    });
  });

  it('maps corpus aliases like cmd+spc and plus', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '++cmd+spc++ ++plus++' }],
        },
      ],
    };

    remarkKeys()(tree);

    expect(tree.children?.[0]).toMatchObject({
      children: [
        {
          type: 'kbd',
          keys: [
            { name: 'cmd', label: 'Cmd' },
            { name: 'spc', label: 'Space' },
          ],
        },
        { type: 'text', value: ' ' },
        {
          type: 'kbd',
          keys: [{ name: 'plus', label: '+' }],
        },
      ],
    });
  });

  it('leaves plain plus-plus in non-key text alone when incomplete', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '基于C++' }],
        },
      ],
    };

    remarkKeys()(tree);
    expect(tree.children?.[0]).toMatchObject({
      children: [{ type: 'text', value: '基于C++' }],
    });
  });
});
