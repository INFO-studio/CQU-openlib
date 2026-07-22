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

const isMarkdownPath = (pathname: string): boolean => {
  return /\.mdx?$/i.test(pathname);
};

/** Resolve `/academic.md` → `academic.md` or `academic/index.md`. */
export const resolveDocFile = (
  docRoot: string,
  pathname: string,
): string | null => {
  let rel = pathname.startsWith('/doc/')
    ? pathname.slice('/doc/'.length)
    : pathname.replace(/^\//, '');
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return null;
  }

  const exact = tryDocFile(docRoot, rel);
  if (exact) return exact;

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
