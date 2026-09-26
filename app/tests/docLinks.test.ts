import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { match } from 'ts-pattern';
import { describe, expect, it } from 'vite-plus/test';
import { FORM_SLUGS } from '~/lib/formTypes';
import { SECTION_APP_PAGES } from '~/lib/nav';
import { decodePathname } from '~/lib/paths';
import type { Mn, MnImage, MnLink, MnRoot } from '~/types/mdast';
import { createDocProcessor } from '~/utils/docProcessor';
import preprocess from '~/utils/preprocess';

const DOC_ROOT = resolve('public/doc');
const PUBLIC_ROOT = resolve('public');
const processor = createDocProcessor();

const walkFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(dir, entry.name);
    return entry.isDirectory()
      ? walkFiles(file)
      : /\.mdx?$/i.test(entry.name)
        ? [file]
        : [];
  });

const DOC_FILES = walkFiles(DOC_ROOT);
const APP_ROUTES = new Set([
  '/map',
  ...SECTION_APP_PAGES.map((page) => page.path),
  ...FORM_SLUGS.map((slug) => `/form/${slug}`),
]);

const parse = (file: string): MnRoot =>
  processor.runSync(
    processor.parse(preprocess(readFileSync(file, 'utf8'))),
  ) as unknown as MnRoot;

const hasChildren = (node: Mn): node is Mn & { children: Mn[] } =>
  'children' in node && Array.isArray(node.children);

const nestedNodes = (node: Mn): Mn[][] =>
  match(node)
    .with({ type: 'tabs' }, ({ items }) =>
      items.flatMap((item) => [item.title, item.children]),
    )
    .with({ type: 'collapseGroup' }, ({ items }) =>
      items.flatMap((item) => [item.title, item.children]),
    )
    .with({ type: 'imageGallery' }, ({ images }) => [images])
    .when(hasChildren, ({ children }) => [children])
    .otherwise(() => []);

const flattenNodes = (nodes: Mn[]): Mn[] =>
  nodes.flatMap((node) => [node, ...nestedNodes(node).flatMap(flattenNodes)]);

const allNodes = (root: MnRoot): Mn[] => flattenNodes(root.children ?? []);
const isLink = (node: Mn): node is MnLink => node.type === 'link';
const isImage = (node: Mn): node is MnImage => node.type === 'image';

const documentCandidates = (sourceFile: string, rawPath: string): string[] => {
  const path = decodePathname(rawPath);
  if (path === '/') return [resolve(DOC_ROOT, 'index.md')];
  const base = path.startsWith('/')
    ? resolve(DOC_ROOT, path.slice(1))
    : resolve(dirname(sourceFile), path);
  if (/\.mdx?$/i.test(base)) {
    const withoutExtension = base.replace(/\.mdx?$/i, '');
    return [base, resolve(withoutExtension, 'index.md')];
  }
  if (extname(base)) return [base];
  return [`${base}.md`, `${base}.mdx`, resolve(base, 'index.md')];
};

const publicCandidates = (sourceFile: string, rawPath: string): string[] => {
  const path = decodePathname(rawPath);
  return path.startsWith('/')
    ? [resolve(PUBLIC_ROOT, path.slice(1))]
    : [resolve(dirname(sourceFile), path)];
};

const resolveTarget = (sourceFile: string, rawUrl: string): string | null => {
  const path = rawUrl.split(/[?#]/, 1)[0] ?? '';
  if (!path) return sourceFile;
  const decoded = decodePathname(path).replace(/\.mdx?$/i, '');
  const routePath = decoded.startsWith('/')
    ? decoded
    : `/${resolve(dirname(sourceFile), decoded)
        .slice(DOC_ROOT.length + 1)
        .replace(/\\/g, '/')}`;
  if (APP_ROUTES.has(routePath)) return null;
  const candidates =
    path.startsWith('/assets/') ||
    path === '/llms.txt' ||
    path.startsWith('/doc/')
      ? publicCandidates(sourceFile, path)
      : documentCandidates(sourceFile, path);
  return candidates.find(existsSync) ?? '';
};

const isExternal = (url: string): boolean =>
  url.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(url);

describe('document links and accessible images', () => {
  const astByFile = new Map(DOC_FILES.map((file) => [file, parse(file)]));

  it('keeps internal links non-empty and backed by a document or public file', () => {
    const links = [...astByFile].flatMap(([file, ast]) =>
      allNodes(ast)
        .filter(isLink)
        .map((node) => ({ file, url: node.url ?? '' })),
    );
    const empty = links.filter(({ url }) => !url).map(({ file }) => file);
    const missing = links
      .filter(({ url }) => url && !url.startsWith('#') && !isExternal(url))
      .filter(({ file, url }) => resolveTarget(file, url) === '')
      .map(({ file, url }) => `${file} -> ${url}`);
    expect(empty).toEqual([]);
    expect(missing).toEqual([]);
  });

  it('keeps internal fragment links backed by generated heading ids', () => {
    const broken = [...astByFile].flatMap(([file, ast]) =>
      allNodes(ast)
        .filter(isLink)
        .filter((node) => !isExternal(node.url ?? ''))
        .map((node) => ({
          file,
          url: node.url ?? '',
          fragment: (node.url ?? '').split('#', 2)[1],
        }))
        .filter(({ fragment }) => Boolean(fragment))
        .filter(({ file: sourceFile, url, fragment }) => {
          const target = resolveTarget(sourceFile, url);
          if (!target || !/\.mdx?$/i.test(target)) return false;
          const targetAst = astByFile.get(target);
          if (!targetAst) return false;
          const ids = new Set(
            allNodes(targetAst)
              .filter((item) => item.type === 'heading')
              .map((heading) => heading.id)
              .filter(Boolean),
          );
          return !ids.has(decodePathname(fragment ?? ''));
        })
        .map(({ file: sourceFile, url }) => `${sourceFile} -> ${url}`),
    );
    expect(broken).toEqual([]);
  });

  it('uses descriptive alt text instead of placeholder names', () => {
    const generic = [...astByFile].flatMap(([file, ast]) =>
      allNodes(ast)
        .filter(isImage)
        .filter((node) =>
          /^(?:pic|img|image|图片)[\s_-]*\d*$/i.test(node.alt ?? ''),
        )
        .map((node) => `${file} -> ${node.alt}`),
    );
    expect(generic).toEqual([]);
  });
});
