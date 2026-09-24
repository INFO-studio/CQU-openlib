import { createHash } from 'node:crypto';
import { type DOMNode, htmlToDOM } from 'html-react-parser';
import { parseDocument } from 'yaml';
import type { SearchEntry } from '../app/lib/nav';
import type { Mn, MnRoot } from '../app/types/mdast';
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
  const match = markdown.match(frontmatterPattern);
  const body = match ? markdown.slice(match[0].length) : markdown;
  const parsed = parseDocument(match?.[1] ?? '');
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
      if (node.type !== 'tag') return '';
      if (['nav', 'footer', 'form', 'svg'].includes(node.name)) return '';
      return `${htmlText(node.children as DOMNode[])} `;
    })
    .join('');

const nodeHtml = (node: Mn): string => {
  if (node.type === 'yaml' || node.type === 'icon') return '';
  if (
    node.type === 'text' ||
    node.type === 'inlineCode' ||
    node.type === 'code'
  )
    return escapeHtml(node.value);
  if (node.type === 'html') return htmlText(htmlToDOM(node.value));
  if (node.type === 'image') return escapeHtml(node.alt ?? '');
  if (node.type === 'imageGallery') return node.images.map(nodeHtml).join(' ');
  if (node.type === 'tabs' || node.type === 'collapseGroup') {
    return node.items
      .map(
        (item) =>
          `<section><p>${childrenHtml(item.title)}</p>${childrenHtml(item.children)}</section>`,
      )
      .join('');
  }
  if (node.type === 'admonition')
    return `<section><p>${childrenHtml(node.title)}</p>${childrenHtml(node.children)}</section>`;
  if (node.type === 'break' || node.type === 'thematicBreak') return ' ';
  if (node.type === 'heading') {
    const id = slugify(textFromChildren(node.children));
    return `<h${node.depth} id="${escapeHtml(id)}">${childrenHtml(node.children)}</h${node.depth}>`;
  }
  if ('children' in node) {
    const content = childrenHtml(node.children as Mn[]);
    if (['paragraph', 'listItem', 'tableRow', 'blockquote'].includes(node.type))
      return `<div>${content}</div>`;
    if (node.type === 'tableCell') return `${content} `;
    return content;
  }
  return '';
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
  const totalHtml = childrenHtml(nodes);
  const parts: { html: string; anchor: string; heading: string }[] = [];
  if (Buffer.byteLength(totalHtml) <= maxRecordBytes) {
    parts.push({ html: totalHtml, anchor: '', heading: '' });
  } else {
    let part = { html: '', anchor: '', heading: '' };
    for (const node of nodes) {
      if (node.type === 'heading' && node.depth >= 2 && node.depth <= 3) {
        if (part.html) parts.push(part);
        const heading = textFromChildren(node.children);
        part = { html: '', anchor: slugify(heading), heading };
      }
      part.html += nodeHtml(node);
    }
    if (part.html) parts.push(part);
    if (parts[0]?.anchor) parts.unshift({ html: '', anchor: '', heading: '' });
  }
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
