import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import type { Connect, Plugin } from 'vite';

const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';
export const mirrorDocMarkdown = (srcDir: string, destDir: string): void => {
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const from = join(srcDir, entry.name);
    const to = join(destDir, entry.name);
    if (entry.isDirectory()) {
      mirrorDocMarkdown(from, to);
      continue;
    }
    if (!/\.mdx?$/i.test(entry.name)) continue;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
  }
};
const isMarkdownPath = (pathname: string): boolean => {
  return /\.mdx?$/i.test(pathname);
};
const resolveDocFile = (docRoot: string, pathname: string): string | null => {
  let rel = pathname.startsWith('/doc/')
    ? pathname.slice('/doc/'.length)
    : pathname.replace(/^\//, '');
  try {
    rel = decodeURIComponent(rel);
  } catch {
    return null;
  }
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
