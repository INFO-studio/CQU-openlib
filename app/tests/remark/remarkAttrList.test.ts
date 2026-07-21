import { describe, expect, it } from 'vite-plus/test';
import type { MnImage, MnLink, MnRoot } from '~/types/mdast';
import remarkAttrList from '~/utils/remark/remarkAttrList';

describe('remarkAttrList', () => {
  it('attaches download filename to preceding link', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              title: null,
              url: '/doc/resources/a.png',
              children: [{ type: 'text', value: '下载' }],
            } satisfies MnLink,
            {
              type: 'text',
              value: '{:download="校徽_蓝色_1024x1024.png"} - ',
            },
            { type: 'inlineCode', value: '1024x1024' },
          ],
        },
      ],
    };

    remarkAttrList()(tree);

    const para = tree.children?.[0];
    expect(para).toMatchObject({
      type: 'paragraph',
      children: [
        {
          type: 'link',
          download: '校徽_蓝色_1024x1024.png',
        },
        { type: 'text', value: ' - ' },
        { type: 'inlineCode', value: '1024x1024' },
      ],
    });
  });

  it('attaches class to preceding image', () => {
    const image: MnImage = {
      type: 'image',
      url: '/doc/resources/a.svg',
      alt: 'preview',
    };
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [image, { type: 'text', value: '{.cqu-logo}' }],
        },
      ],
    };

    remarkAttrList()(tree);

    expect(image.className).toBe('cqu-logo');
    expect(tree.children?.[0]).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'image' }],
    });
  });
});
