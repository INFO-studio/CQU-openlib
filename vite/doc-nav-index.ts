import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { Plugin } from 'vite';
import { ALPHA_LETTERS, letterOfTitle } from '../app/lib/courseAlpha';
import {
  type DocNavIndex,
  NAV_SECTIONS,
  type SearchChunkFile,
  type SearchChunkMeta,
  type SearchEntry,
  type SidebarNode,
  titleFromPath,
} from '../app/lib/nav';

type CourseCodesMeta = {
  courses?: Record<
    string,
    {
      codes?: string[];
    }
  >;
};
const loadCourseCodes = (root: string): Map<string, string[]> => {
  const file = join(root, 'public', 'metadata', 'course-codes.json');
  const map = new Map<string, string[]>();
  if (!existsSync(file)) return map;
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as CourseCodesMeta;
    for (const [path, entry] of Object.entries(raw.courses ?? {})) {
      if (entry.codes?.length) map.set(path, entry.codes);
    }
  } catch {
    // metadata missing/corrupt — search still works without codes
  }
  return map;
};
const attachCodes = (
  nodes: SidebarNode[],
  codesByPath: Map<string, string[]>,
): SidebarNode[] => {
  return nodes.map((node) => ({
    ...node,
    codes: codesByPath.get(node.path),
    children: node.children
      ? attachCodes(node.children, codesByPath)
      : undefined,
  }));
};
const SKIP_DIRS = new Set([
  'assets',
  'javascripts',
  'resources',
  '42',
  'notice',
]);
const listMarkdownFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...listMarkdownFiles(full));
      continue;
    }
    if (/\.mdx?$/i.test(entry.name)) out.push(full);
  }
  return out;
};
const urlFromDocFile = (docRoot: string, file: string): string => {
  const rel = relative(docRoot, file).replace(/\\/g, '/');
  if (rel === 'index.md') return '/';
  if (rel.endsWith('/index.md')) return `/${rel.slice(0, -'/index.md'.length)}`;
  return `/${rel.replace(/\.mdx?$/i, '')}`;
};
const buildTree = (docRoot: string, sectionDir: string): SidebarNode[] => {
  if (!existsSync(sectionDir)) return [];
  const nodes: SidebarNode[] = [];
  for (const entry of readdirSync(sectionDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = join(sectionDir, entry.name);
    if (entry.isDirectory()) {
      const indexFile = join(full, 'index.md');
      const children = buildTree(docRoot, full);
      const path = existsSync(indexFile)
        ? urlFromDocFile(docRoot, indexFile)
        : children[0]?.path;
      if (!path) continue;
      nodes.push({
        title: entry.name,
        path,
        children: children.length ? children : undefined,
      });
      continue;
    }
    if (!/\.mdx?$/i.test(entry.name)) continue;
    if (entry.name === 'index.md') continue;
    nodes.push({
      title: titleFromPath(entry.name),
      path: urlFromDocFile(docRoot, full),
    });
  }
  return nodes.sort((a, b) =>
    a.title.localeCompare(b.title, 'zh-CN', { sensitivity: 'base' }),
  );
};
const sortEntries = (entries: SearchEntry[]) => {
  return entries.sort((a, b) =>
    a.title.localeCompare(b.title, 'zh-CN', { sensitivity: 'base' }),
  );
};
const writeChunk = (dir: string, chunk: SearchChunkFile): SearchChunkMeta => {
  const file = `${chunk.id}.json`;
  writeFileSync(join(dir, file), `${JSON.stringify(chunk)}\n`, 'utf8');
  return {
    id: chunk.id,
    url: `/search/chunks/${file}`,
    label: chunk.label,
    count: chunk.entries.length,
  };
};
export const buildDocNavIndex = (
  docRoot: string,
  projectRoot = join(docRoot, '..', '..'),
): {
  index: DocNavIndex;
  chunks: SearchChunkFile[];
} => {
  const codesByPath = loadCourseCodes(projectRoot);
  const chunks: SearchChunkFile[] = [];
  chunks.push({
    id: 'home',
    label: '首页',
    entries: [
      {
        title: '欢迎',
        path: '/',
        section: 'home',
        sectionLabel: '首页',
      },
    ],
  });
  const courseByLetter = new Map<string, SearchEntry[]>();
  const sections = NAV_SECTIONS.map((section) => {
    if (section.kind === 'file') {
      const file = join(docRoot, section.source);
      const entries: SearchEntry[] = [];
      if (existsSync(file)) {
        entries.push({
          title: section.label,
          path: section.path,
          section: section.id,
          sectionLabel: section.label,
          codes: codesByPath.get(section.path),
        });
      }
      if (entries.length) {
        chunks.push({
          id: `section-${section.id}`,
          label: section.label,
          entries: sortEntries(entries),
        });
      }
      return { ...section, tree: [] as SidebarNode[] };
    }
    const sectionDir = join(docRoot, section.source);
    const tree = attachCodes(buildTree(docRoot, sectionDir), codesByPath);
    const files = listMarkdownFiles(sectionDir);
    const sectionEntries: SearchEntry[] = [];
    for (const file of files) {
      const path = urlFromDocFile(docRoot, file);
      const entry: SearchEntry = {
        title: titleFromPath(relative(docRoot, file)),
        path,
        section: section.id,
        sectionLabel: section.label,
        codes: codesByPath.get(path),
      };
      if (section.id === 'course') {
        const letter = letterOfTitle(entry.title);
        const list = courseByLetter.get(letter) ?? [];
        list.push(entry);
        courseByLetter.set(letter, list);
      } else {
        sectionEntries.push(entry);
      }
    }
    const sectionIndex = join(sectionDir, 'index.md');
    if (existsSync(sectionIndex)) {
      const path = urlFromDocFile(docRoot, sectionIndex);
      const rootEntry: SearchEntry = {
        title: section.label,
        path,
        section: section.id,
        sectionLabel: section.label,
        codes: codesByPath.get(path),
      };
      if (section.id === 'course') {
        // Course root stays in its own tiny chunk with section label.
        sectionEntries.push(rootEntry);
      } else if (!sectionEntries.some((s) => s.path === path)) {
        sectionEntries.push(rootEntry);
      }
    }
    if (section.id !== 'course' && sectionEntries.length) {
      chunks.push({
        id: `section-${section.id}`,
        label: section.label,
        entries: sortEntries(sectionEntries),
      });
    } else if (section.id === 'course' && sectionEntries.length) {
      chunks.push({
        id: 'section-course-root',
        label: '课程',
        entries: sortEntries(sectionEntries),
      });
    }
    return { ...section, tree };
  });
  for (const letter of ALPHA_LETTERS) {
    const entries = courseByLetter.get(letter);
    if (!entries?.length) continue;
    chunks.push({
      id: `course-${letter === '#' ? 'hash' : letter}`,
      label: `课程 ${letter}`,
      entries: sortEntries(entries),
    });
  }
  const index: DocNavIndex = {
    generatedAt: new Date().toISOString(),
    sections,
    searchManifest: { chunks: [] },
  };
  return { index, chunks };
};
const writeIndex = (
  docRoot: string,
  publicRoot: string,
  projectRoot: string,
) => {
  const { index, chunks } = buildDocNavIndex(docRoot, projectRoot);
  const chunkDir = join(publicRoot, 'search', 'chunks');
  if (existsSync(chunkDir)) {
    rmSync(chunkDir, { recursive: true, force: true });
  }
  mkdirSync(chunkDir, { recursive: true });
  const manifest: SearchChunkMeta[] = chunks
    .filter((c) => c.entries.length > 0)
    .map((c) => writeChunk(chunkDir, c));
  index.searchManifest = { chunks: manifest };
  const outFile = join(publicRoot, 'nav-index.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(index)}\n`, 'utf8');
  return index;
};
const copyNavArtifacts = (publicRoot: string, destRoot: string) => {
  mkdirSync(destRoot, { recursive: true });
  writeFileSync(
    join(destRoot, 'nav-index.json'),
    readFileSync(join(publicRoot, 'nav-index.json')),
  );
  const fromChunks = join(publicRoot, 'search', 'chunks');
  const toChunks = join(destRoot, 'search', 'chunks');
  if (!existsSync(fromChunks)) return;
  mkdirSync(toChunks, { recursive: true });
  for (const name of readdirSync(fromChunks)) {
    writeFileSync(join(toChunks, name), readFileSync(join(fromChunks, name)));
  }
};
export const docNavIndexPlugin = (): Plugin => {
  let root = process.cwd();
  let outDir = 'build/client';
  const emit = () => {
    const docRoot = join(root, 'public', 'doc');
    const publicRoot = join(root, 'public');
    writeIndex(docRoot, publicRoot, root);
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
      server.watcher.add(docRoot);
      const meta = join(root, 'public', 'metadata');
      if (existsSync(meta)) server.watcher.add(meta);
      server.watcher.on('all', (event, file) => {
        if (!file.startsWith(docRoot) && !file.startsWith(meta)) return;
        if (
          file.startsWith(docRoot) &&
          !/\.mdx?$/i.test(file) &&
          event !== 'unlinkDir' &&
          event !== 'addDir'
        ) {
          return;
        }
        emit();
      });
    },
    closeBundle() {
      // Vitest sets outDir to a sentinel that must not be created
      // (`dummy-non-existing-folder`). Only copy into a real build output.
      const dest = join(root, outDir);
      if (!existsSync(dest)) return;
      copyNavArtifacts(join(root, 'public'), dest);
    },
  };
};
