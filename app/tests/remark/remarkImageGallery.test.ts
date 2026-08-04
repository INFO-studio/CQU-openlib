import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { MnImage, MnParagraph, MnRoot } from '~/types/mdast';
import parser from '~/utils/parser';
import preprocess from '~/utils/preprocess';
import {
  IMAGE_GALLERY_END,
  IMAGE_GALLERY_START,
} from '~/utils/preprocess/placeholders';
import {
  remarkAttrList,
  remarkCollapseGroup,
  remarkContentTabs,
  remarkDisableIndentedCode,
  removePosition,
} from '~/utils/remark';
import remarkImageGallery from '~/utils/remark/remarkImageGallery';

const imageParagraph = (name: string, preview = true): MnParagraph => ({
  type: 'paragraph',
  children: [
    {
      type: 'image',
      url: `/doc/resources/${name}.webp`,
      alt: name,
      preview,
    } satisfies MnImage,
  ],
});

const toAst = async (source: string): Promise<MnRoot> => {
  const processor = unified()
    .use(remarkDisableIndentedCode)
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkContentTabs)
    .use(remarkCollapseGroup)
    .use(remarkAttrList)
    .use(remarkImageGallery);
  return removePosition(
    (await processor.run(processor.parse(preprocess(source)))) as MnRoot,
  ) as MnRoot;
};

describe('remarkImageGallery', () => {
  it('folds consecutive preview image paragraphs into one gallery', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        { type: 'html', value: IMAGE_GALLERY_START },
        imageParagraph('a'),
        imageParagraph('b'),
        { type: 'html', value: IMAGE_GALLERY_END },
      ],
    };

    remarkImageGallery()(tree);

    expect(tree.children).toEqual([
      {
        type: 'imageGallery',
        images: [
          {
            type: 'image',
            url: '/doc/resources/a.webp',
            alt: 'a',
            preview: true,
          },
          {
            type: 'image',
            url: '/doc/resources/b.webp',
            alt: 'b',
            preview: true,
          },
        ],
      },
    ]);
  });

  it('does not implicitly group adjacent preview images', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [imageParagraph('a'), imageParagraph('b')],
    };

    remarkImageGallery()(tree);

    expect(tree.children?.map((node) => node.type)).toEqual([
      'paragraph',
      'paragraph',
    ]);
  });

  it('folds galleries nested inside collapse items', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'collapseGroup',
          items: [
            {
              title: [{ type: 'text', value: '证据' }],
              children: [
                { type: 'html', value: IMAGE_GALLERY_START },
                imageParagraph('a'),
                imageParagraph('b'),
                { type: 'html', value: IMAGE_GALLERY_END },
              ],
            },
          ],
        },
      ],
    };

    remarkImageGallery()(tree);

    const group = tree.children?.[0];
    expect(group?.type).toBe('collapseGroup');
    if (group?.type !== 'collapseGroup') throw new Error('expected group');
    expect(group.items[0]?.children[0]?.type).toBe('imageGallery');
  });

  it('renders semantic figures with preview controls', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        { type: 'html', value: IMAGE_GALLERY_START },
        imageParagraph('证据一'),
        imageParagraph('证据二'),
        { type: 'html', value: IMAGE_GALLERY_END },
      ],
    };
    remarkImageGallery()(tree);

    const html = renderToStaticMarkup(
      createElement(Fragment, null, parser(tree)),
    );
    expect(html.match(/<figure/g)).toHaveLength(2);
    expect(html.match(/<figcaption/g)).toHaveLength(2);
    expect(html).toContain('全屏查看：证据一');
    expect(html).toContain('cquol-image-gallery');
  });

  it('parses a preview gallery inside collapse Markdown', async () => {
    const tree = await toAst(
      [
        '^^^ 证据',
        '    <ImageGallery>',
        '    ![第一张](/doc/resources/a.webp){:preview}',
        '',
        '    ![第二张](/doc/resources/b.webp){:preview}',
        '    </ImageGallery>',
      ].join('\n'),
    );
    const group = tree.children?.[0];
    expect(group?.type).toBe('collapseGroup');
    if (group?.type !== 'collapseGroup') throw new Error('expected group');
    expect(group.items[0]?.children[0]).toMatchObject({
      type: 'imageGallery',
      images: [
        { alt: '第一张', preview: true },
        { alt: '第二张', preview: true },
      ],
    });
  });
});
