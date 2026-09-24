import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Plugin } from 'vite';
import {
  type DocNavIndex,
  NAV_SECTIONS,
  SECTION_APP_PAGES,
  type SearchEntry,
  type SidebarNode,
  titleFromPath,
} from '../app/lib/nav';
import { compareTitles } from '../app/lib/titleOrder';
import { letterOfTitle } from './courseLetter';
import { listFolderPages } from './docMarkdown';

type CourseCodesMeta = {
  courses?: Record<string, { codes?: string[] }>;
};
const loadCourseCodes = (root: string): Map<string, string[]> => {
  const file = join(root, 'metadata', 'course-codes.json');
  const map = new Map<string, string[]>();
  if (!existsSync(file)) return map;
  const raw = JSON.parse(readFileSync(file, 'utf8')) as CourseCodesMeta;
  for (const [path, entry] of Object.entries(raw.courses ?? {})) {
    if (entry.codes?.length) map.set(path, entry.codes);
  }
  return map;
};
const attachCodes = (
  nodes: SidebarNode[],
  codesByPath: Map<string, string[]>,
): SidebarNode[] =>
  nodes.map((node) => ({
    ...node,
    codes: codesByPath.get(node.path),
    children: node.children
      ? attachCodes(node.children, codesByPath)
      : undefined,
  }));

const attachLetters = (nodes: SidebarNode[]): SidebarNode[] =>
  nodes.map((node) =>
    node.children?.length
      ? { ...node, children: attachLetters(node.children) }
      : { ...node, letter: letterOfTitle(node.title) },
  );

const skipSearchPrefixes = ['sundry/更新日志/'];
const isSearchable = (docRoot: string, file: string): boolean => {
  const rel = relative(docRoot, file).replace(/\\/g, '/');
  return !skipSearchPrefixes.some(
    (prefix) => rel.startsWith(prefix) && rel !== `${prefix}index.md`,
  );
};
const listMarkdownFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (/\.mdx?$/i.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};
const urlFromDocFile = (docRoot: string, file: string): string => {
  const rel = relative(docRoot, file).replace(/\\/g, '/');
  if (rel === 'index.md') return '/';
  if (rel.endsWith('/index.md')) return `/${rel.slice(0, -'/index.md'.length)}`;
  return `/${rel.replace(/\.mdx?$/i, '')}`;
};
const buildTree = (
  docRoot: string,
  sectionDir: string,
  useIndexOrder = false,
  extras: SidebarNode[] = [],
): SidebarNode[] => {
  if (!existsSync(sectionDir)) return [];
  const nodes: SidebarNode[] = [...extras];
  for (const entry of readdirSync(sectionDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(sectionDir, entry.name);
    if (entry.isDirectory()) {
      const indexFile = join(full, 'index.md');
      const children = buildTree(docRoot, full, useIndexOrder);
      const dirPath = `/${relative(docRoot, full).replace(/\\/g, '/')}`;
      if (existsSync(indexFile)) {
        nodes.push({
          title: entry.name,
          path: urlFromDocFile(docRoot, indexFile),
          children: children.length ? children : undefined,
        });
      } else {
        const first = children[0]?.path;
        if (!first) continue;
        nodes.push({
          title: entry.name,
          path: first,
          matchPrefix: dirPath,
          children,
        });
      }
      continue;
    }
    if (!/\.mdx?$/i.test(entry.name) || entry.name === 'index.md') continue;
    nodes.push({
      title: titleFromPath(entry.name),
      path: urlFromDocFile(docRoot, full),
    });
  }
  const sorted = nodes.sort((a, b) => compareTitles(a.title, b.title));
  return useIndexOrder
    ? orderByIndex(sorted, indexLinkOrder(docRoot, sectionDir))
    : sorted;
};
const indexLinkOrder = (docRoot: string, dir: string): string[] => {
  const indexFile = join(dir, 'index.md');
  if (!existsSync(indexFile)) return [];
  const order: string[] = [];
  for (const [, raw] of readFileSync(indexFile, 'utf8').matchAll(
    /]\(([^)\s]+)\)/g,
  )) {
    if (/^(?:[a-z]+:)?\//i.test(raw)) continue;
    const target = decodeURI(raw.split('#')[0] ?? '');
    const isDoc = /\.mdx?$/i.test(target);
    if (!target || (!isDoc && /\.[a-z0-9]+$/i.test(target))) continue;
    const full = join(dir, target);
    const path = isDoc
      ? urlFromDocFile(docRoot, full)
      : `/${relative(docRoot, full).replace(/\\/g, '/')}`;
    if (!order.includes(path)) order.push(path);
  }
  return order;
};
const orderByIndex = (nodes: SidebarNode[], order: string[]): SidebarNode[] => {
  const rank = new Map(order.map((path, i) => [path, i]));
  return [...nodes].sort((a, b) => {
    const rankA = rank.get(a.path) ?? order.length;
    const rankB = rank.get(b.path) ?? order.length;
    return rankA - rankB || compareTitles(a.title, b.title);
  });
};

export type IndexedDocument = SearchEntry & { file?: string };

export const buildDocNavIndex = (
  docRoot: string,
  projectRoot = join(docRoot, '..', '..'),
): { index: DocNavIndex; documents: IndexedDocument[] } => {
  const codesByPath = loadCourseCodes(projectRoot);
  const documents: IndexedDocument[] = [];
  const homeFile = join(docRoot, 'index.md');
  if (existsSync(homeFile)) {
    documents.push({
      title: '首页',
      path: '/',
      section: 'home',
      sectionLabel: '首页',
      file: homeFile,
    });
  }
  const sections = NAV_SECTIONS.map((section) => {
    const sectionDir = join(docRoot, section.source);
    const appPages = SECTION_APP_PAGES.filter((p) => p.section === section.id);
    const files =
      section.kind === 'file'
        ? existsSync(sectionDir)
          ? [sectionDir]
          : []
        : listMarkdownFiles(sectionDir);
    for (const file of files) {
      if (!isSearchable(docRoot, file)) continue;
      const path = urlFromDocFile(docRoot, file);
      documents.push({
        title:
          path === section.path
            ? section.label
            : titleFromPath(relative(docRoot, file)),
        path,
        file,
        section: section.id,
        sectionLabel: section.label,
        codes: codesByPath.get(path),
      });
    }
    for (const page of appPages) {
      documents.push({ ...page, sectionLabel: section.label });
    }
    if (section.kind === 'file')
      return { ...section, tree: [] as SidebarNode[] };
    const withCodes = attachCodes(
      buildTree(
        docRoot,
        sectionDir,
        section.indexOrder,
        appPages.map(({ title, path }) => ({ title, path })),
      ),
      codesByPath,
    );
    return {
      ...section,
      tree: section.id === 'course' ? attachLetters(withCodes) : withCodes,
    };
  });
  return {
    index: { generatedAt: new Date().toISOString(), sections },
    documents: documents.sort(
      (a, b) => compareTitles(a.title, b.title) || a.path.localeCompare(b.path),
    ),
  };
};

const writeIndex = (
  docRoot: string,
  publicRoot: string,
  projectRoot: string,
) => {
  const { index } = buildDocNavIndex(docRoot, projectRoot);
  const outFile = join(publicRoot, 'nav-index.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(index)}\n`, 'utf8');
};
const writeFolderPages = (docRoot: string, projectRoot: string) => {
  const file = join(projectRoot, 'metadata', 'doc-folder-pages.json');
  const next = `${JSON.stringify(listFolderPages(docRoot), null, 2)}\n`;
  if (existsSync(file) && readFileSync(file, 'utf8') === next) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, next, 'utf8');
};
export const docNavIndexPlugin = (): Plugin => {
  let root = process.cwd();
  let outDir = 'build/client';
  const emit = () => {
    const docRoot = join(root, 'public', 'doc');
    writeIndex(docRoot, join(root, 'public'), root);
    writeFolderPages(docRoot, root);
  };
  return {
    name: 'doc-nav-index',
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    buildStart() {
      emit();
    },
    configureServer(server) {
      emit();
      const docRoot = join(root, 'public', 'doc');
      const meta = join(root, 'metadata');
      server.watcher.add(docRoot);
      if (existsSync(meta)) server.watcher.add(meta);
      server.watcher.on('all', (event, file) => {
        if (!file.startsWith(docRoot) && !file.startsWith(meta)) return;
        if (
          file.startsWith(docRoot) &&
          !/\.mdx?$/i.test(file) &&
          event !== 'unlinkDir' &&
          event !== 'addDir'
        )
          return;
        emit();
      });
    },
    closeBundle() {
      const dest = join(root, outDir);
      if (!existsSync(dest)) return;
      writeFileSync(
        join(dest, 'nav-index.json'),
        readFileSync(join(root, 'public', 'nav-index.json')),
      );
    },
  };
};
