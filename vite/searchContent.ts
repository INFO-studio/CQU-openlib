import { createHash } from 'node:crypto';
import { type DOMNode, htmlToDOM } from 'html-react-parser';
import { match } from 'ts-pattern';
import { parseDocument } from 'yaml';
import type { SearchEntry } from '../app/lib/nav';
import type { Mn, MnHeading, MnRoot } from '../app/types/mdast';
import { createDocProcessor } from '../app/utils/docProcessor';
import { slugify, textFromChildren } from '../app/utils/headingText';
import { isPlaceholderKey } from '../app/utils/placeholderMap';
import preprocess from '../app/utils/preprocess';

export type SearchDocument = SearchEntry & { file?: string };
export type SearchRecord = { url: string; content: string };
const processor = createDocProcessor();
const maxRecordBytes = 12_000;
const frontmatterPattern = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const strings = (value: unknown, field: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`${field} 必须是字符串数组`);
  }
  return [...new Set(value.map((v: string) => v.trim()).filter(Boolean))];
};

export const searchMetadata = (markdown: string) => {
  const matched = markdown.match(frontmatterPattern);
  const body = matched ? markdown.slice(matched[0].length) : markdown;
  const parsed = parseDocument(matched?.[1] ?? '');
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  const metadata = parsed.toJS({ maxAliasCount: 0 }) ?? {};
  if (typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('frontmatter 必须是键值对象');
  }
  if (
    metadata.placeholder !== undefined &&
    (typeof metadata.placeholder !== 'string' ||
      !isPlaceholderKey(metadata.placeholder))
  ) {
    throw new Error('未知的 placeholder 模板');
  }
  const search = metadata.search ?? {};
  if (typeof search !== 'object' || Array.isArray(search)) {
    throw new Error('search 必须是键值对象');
  }
  return {
    body,
    keywords: strings(search.keywords, 'search.keywords'),
    codes: strings(search.codes, 'search.codes'),
  };
};

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!,
  );

const childrenHtml = (nodes: Mn[] | undefined): string =>
  (nodes ?? []).map(nodeHtml).join('');
const htmlText = (nodes: DOMNode[]): string =>
  nodes
    .map((node) => {
      if (node.type === 'text') return escapeHtml(node.data);
      if (
        node.type !== 'tag' ||
        ['nav', 'footer', 'form', 'svg'].includes(node.name)
      )
        return '';
      return `${htmlText(node.children as DOMNode[])} `;
    })
    .join('');

const nodeHtml = (node: Mn): string =>
  match(node)
    .with({ type: 'yaml' }, { type: 'icon' }, () => '')
    .with(
      { type: 'text' },
      { type: 'inlineCode' },
      { type: 'code' },
      ({ value }) => escapeHtml(value),
    )
    .with({ type: 'html' }, ({ value }) => htmlText(htmlToDOM(value)))
    .with({ type: 'image' }, ({ alt }) => escapeHtml(alt ?? ''))
    .with({ type: 'imageGallery' }, ({ images }) =>
      images.map(nodeHtml).join(' '),
    )
    .with({ type: 'tabs' }, { type: 'collapseGroup' }, ({ items }) =>
      items
        .map(
          (item) =>
            `<section><p>${childrenHtml(item.title)}</p>${childrenHtml(item.children)}</section>`,
        )
        .join(''),
    )
    .with(
      { type: 'admonition' },
      ({ title, children }) =>
        `<section><p>${childrenHtml(title)}</p>${childrenHtml(children)}</section>`,
    )
    .with({ type: 'break' }, { type: 'thematicBreak' }, () => ' ')
    .with({ type: 'heading' }, (heading) => {
      const id = heading.id ?? slugify(textFromChildren(heading.children));
      return `<h${heading.depth} id="${escapeHtml(id)}">${childrenHtml(heading.children)}</h${heading.depth}>`;
    })
    .with(
      { type: 'paragraph' },
      { type: 'listItem' },
      { type: 'tableRow' },
      { type: 'blockquote' },
      ({ children }) => `<div>${childrenHtml(children)}</div>`,
    )
    .with({ type: 'tableCell' }, ({ children }) => `${childrenHtml(children)} `)
    .otherwise((parent) =>
      'children' in parent ? childrenHtml(parent.children) : '',
    );

type SearchPart = { html: string; anchor: string; heading: string };
const isSectionHeading = (node: Mn): node is MnHeading =>
  node.type === 'heading' && node.depth >= 2 && node.depth <= 3;

const splitSearchParts = (nodes: Mn[], html: string): SearchPart[] => {
  if (Buffer.byteLength(html) <= maxRecordBytes)
    return [{ html, anchor: '', heading: '' }];
  const boundaries = [
    0,
    ...nodes.flatMap((node, index) =>
      index > 0 && isSectionHeading(node) ? [index] : [],
    ),
  ];
  const parts = boundaries
    .map((start, index): SearchPart => {
      const node = nodes[start];
      const heading =
        node && isSectionHeading(node) ? textFromChildren(node.children) : '';
      return {
        html: childrenHtml(nodes.slice(start, boundaries[index + 1])),
        anchor:
          node && isSectionHeading(node) ? (node.id ?? slugify(heading)) : '',
        heading,
      };
    })
    .filter((part) => part.html);
  return parts[0]?.anchor
    ? [{ html: '', anchor: '', heading: '' }, ...parts]
    : parts;
};

export const buildSearchRecords = (
  doc: SearchDocument,
  markdown: string,
): SearchRecord[] => {
  const metadata = searchMetadata(markdown);
  const codes = [
    ...new Set(
      [...(doc.codes ?? []), ...metadata.codes].map((code) =>
        code.trim().toUpperCase(),
      ),
    ),
  ];
  const tree = processor.runSync(
    processor.parse(preprocess(metadata.body)),
  ) as unknown as MnRoot;
  const nodes = (tree.children ?? []).filter((node) => node.type !== 'yaml');
  const parts = splitSearchParts(nodes, childrenHtml(nodes));
  const meta = (key: string, value: string) =>
    `<meta data-pagefind-meta="${key}[content]" content="${escapeHtml(value)}">`;
  return parts.map((part) => {
    const url = `${doc.path}${part.anchor ? `#${part.anchor}` : ''}`;
    const head = [
      meta('title', doc.title),
      meta('page', doc.path),
      meta('section', doc.sectionLabel),
      meta('heading', part.heading),
      meta('codes', codes.join(' ')),
    ].join('');
    return {
      url,
      content: `<html lang="zh"><head>${head}</head><body data-pagefind-body><h1>${escapeHtml(doc.title)}</h1><p data-pagefind-weight="8">${escapeHtml(codes.join(' '))}</p><p data-pagefind-weight="5">${escapeHtml(metadata.keywords.join(' '))}</p>${part.html}</body></html>`,
    };
  });
};

export const recordFingerprint = (records: SearchRecord[]) =>
  createHash('sha256')
    .update(JSON.stringify(records))
    .digest('hex')
    .slice(0, 16);
