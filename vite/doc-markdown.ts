import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { basename, dirname, join, normalize, relative, sep } from 'node:path';
import type { Connect, Plugin } from 'vite';

const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';

const tryDocFile = (docRoot: string, rel: string): string | null => {
  const file = normalize(join(docRoot, rel));
  const root = normalize(docRoot);
  const relToRoot = relative(root, file);
  if (relToRoot.startsWith('..') || relToRoot.includes(`..${sep}`)) {
    return null;
  }
  if (!existsSync(file) || !statSync(file).isFile()) {
    return null;
  }
  return file;
};

/**
 * Copy markdown under public/doc into the publish root so /path.md is a static
 * file (Netlify/GH Pages shadow the SPA fallback).
 *
 * Folder indexes (foo/index.md) also emit foo.md so clean page URLs map to raw
 * markdown the Fumadocs / llms.txt way: /academic → /academic.md.
 */
export const mirrorDocMarkdown = (
  srcDir: string,
  destDir: string,
  destRoot = destDir,
): void => {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const from = join(srcDir, entry.name);
    const to = join(destDir, entry.name);
    if (entry.isDirectory()) {
      mirrorDocMarkdown(from, to, destRoot);
      continue;
    }
    if (!/\.mdx?$/i.test(entry.name)) continue;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);

    if (!/^index\.mdx?$/i.test(entry.name)) continue;
    const folderPath = dirname(to);
    if (normalize(folderPath) === normalize(destRoot)) continue;
    const ext = entry.name.match(/\.mdx?$/i)?.[0] ?? '.md';
    const aliasPath = join(
      dirname(folderPath),
      `${basename(folderPath)}${ext}`,
    );
    mkdirSync(dirname(aliasPath), { recursive: true });
    cpSync(from, aliasPath);
  }
};

/**
 * Clean page paths backed by `<page>/index.md` instead of `<page>.md`.
 *
 * The two layouts need different base dirs for relative links (`/academic` vs
 * `/course`), so a single URL shape cannot serve both and the client has to
 * know which is which before it fetches. Writing the list to
 * metadata/doc-folder-pages.json lets the bundle inline it, turning that
 * question into zero bytes of latency instead of a speculative 404.
 */
export const listFolderPages = (docRoot: string): string[] => {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const page = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (
        tryDocFile(docRoot, `${page}/index.md`) ||
        tryDocFile(docRoot, `${page}/index.mdx`)
      ) {
        out.push(page);
      }
      walk(join(dir, entry.name), page);
    }
  };
  walk(docRoot, '');
  return out.sort();
};

const isMarkdownPath = (pathname: string): boolean => {
  return /\.mdx?$/i.test(pathname);
};

/** Resolve `/academic.md` → `academic.md` or `academic/index.md`. */
export const resolveDocFile = (
  docRoot: string,
  pathname: string,
): string | null => {
  const underDoc = pathname.startsWith('/doc/');
  let rel = underDoc
    ? pathname.slice('/doc/'.length)
    : pathname.replace(/^\//, '');
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return null;
  }

  const exact = tryDocFile(docRoot, rel);
  if (exact) return exact;

  // Only the root mirror aliases <folder>/index.md as <folder>.md. Under /doc/
  // the tree is served verbatim, so dev must 404 exactly where production does.
  if (underDoc) return null;
  if (!/\.mdx?$/i.test(rel)) return null;
  const withoutExt = rel.replace(/\.mdx?$/i, '');
  if (!withoutExt || withoutExt.endsWith('/index')) return null;
  return (
    tryDocFile(docRoot, `${withoutExt}/index.md`) ??
    tryDocFile(docRoot, `${withoutExt}/index.mdx`)
  );
};

const serveMarkdown = (
  getDocRoot: () => string,
): Connect.NextHandleFunction => {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const raw = req.url ?? '';
    const q = raw.indexOf('?');
    const pathname = q === -1 ? raw : raw.slice(0, q);
    if (
      !isMarkdownPath(pathname) ||
      pathname.startsWith('/@') ||
      pathname.startsWith('/node_modules')
    ) {
      next();
      return;
    }
    const file = resolveDocFile(getDocRoot(), pathname);
    if (!file) {
      next();
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', MARKDOWN_CONTENT_TYPE);
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  };
};

export const docMarkdownPlugin = (): Plugin => {
  let docRoot = '';
  let outDir = 'build/client';
  let root = process.cwd();
  return {
    name: 'doc-markdown',
    configResolved(config) {
      root = config.root;
      docRoot = join(config.root, 'public', 'doc');
      outDir = config.build.outDir;
    },
    configureServer(server) {
      server.middlewares.use(serveMarkdown(() => docRoot));
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveMarkdown(() => docRoot));
    },
    closeBundle() {
      // Skip Vitest's sentinel outDir (never create / write into it).
      const dest = join(root, outDir);
      if (!existsSync(dest)) return;
      mirrorDocMarkdown(docRoot, dest);
    },
  };
};
