import { match } from 'ts-pattern';
import type { Mn, MnImage, MnImageGallery, MnRoot } from '~/types/mdast';
import {
  IMAGE_GALLERY_END,
  IMAGE_GALLERY_START,
} from '~/utils/preprocess/placeholders';

const isHtml = (node: Mn, value: string) =>
  node.type === 'html' && node.value === value;

const previewImageFromParagraph = (node: Mn): MnImage | null => {
  if (node.type !== 'paragraph' || node.children?.length !== 1) return null;
  const image = node.children[0];
  return image?.type === 'image' && image.preview ? image : null;
};

const descend = (node: Mn): Mn =>
  match(node)
    .with({ type: 'tabs' }, { type: 'collapseGroup' }, (parent) => ({
      ...parent,
      items: parent.items.map((item) => ({
        ...item,
        children: convertImageGalleries(item.children),
      })),
    }))
    .with({ type: 'admonition' }, { type: 'root' }, (parent) => ({
      ...parent,
      children: convertImageGalleries(parent.children ?? []),
    }))
    .with(
      { type: 'blockquote' },
      { type: 'footnoteDefinition' },
      { type: 'list' },
      { type: 'listItem' },
      (parent) => ({
        ...parent,
        children: convertImageGalleries(parent.children),
      }),
    )
    .otherwise((current) => current);

const parseImageGallery = (
  nodes: Mn[],
  start: number,
): { output: Mn[]; next: number } => {
  const body: Mn[] = [];
  let index = start;
  while (index < nodes.length && !isHtml(nodes[index]!, IMAGE_GALLERY_END)) {
    body.push(nodes[index]!);
    index += 1;
  }

  const images = body.map(previewImageFromParagraph);
  const valid = images.length > 0 && images.every((image) => image !== null);
  return {
    output: valid
      ? [
          {
            type: 'imageGallery',
            images: images as MnImage[],
          } satisfies MnImageGallery,
        ]
      : body.map(descend),
    next: index < nodes.length ? index + 1 : index,
  };
};

const convertImageGalleries = (nodes: Mn[]): Mn[] => {
  const out: Mn[] = [];
  let index = 0;

  while (index < nodes.length) {
    const node = nodes[index]!;
    if (isHtml(node, IMAGE_GALLERY_START)) {
      const gallery = parseImageGallery(nodes, index + 1);
      out.push(...gallery.output);
      index = gallery.next;
      continue;
    }
    out.push(descend(node));
    index += 1;
  }

  return out;
};

const remarkImageGallery = () => (tree: MnRoot) => {
  tree.children = convertImageGalleries(tree.children ?? []);
};

export default remarkImageGallery;
