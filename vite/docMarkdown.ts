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

const markdownContentType = 'text/markdown; charset=utf-8';
const tryDocFile = (docRoot: string, rel: string): string | null => {
  const file = normalize(join(docRoot, rel));
  const root = normalize(docRoot);
  const relToRoot = relative(root, file);
  if (relToRoot.startsWith('..') || relToRoot.includes(`..${sep}`)) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
};

// Root mirrors also expose directory indexes as <folder>.md.
export const mirrorDocMarkdown = (
  srcDir: string,
  destDir: string,
  destRoot = destDir,
): void => {
  readdirSync(srcDir, { withFileTypes: true }).forEach((entry) => {
    const from = join(srcDir, entry.name);
    const to = join(destDir, entry.name);
    if (entry.isDirectory()) {
      mirrorDocMarkdown(from, to, destRoot);
      return;
    }
    if (!/\.mdx?$/i.test(entry.name)) return;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to);
    if (!/^index\.mdx?$/i.test(entry.name)) return;
    const folderPath = dirname(to);
    if (normalize(folderPath) === normalize(destRoot)) return;
    const ext = entry.name.match(/\.mdx?$/i)?.[0] ?? '.md';
    const aliasPath = join(
      dirname(folderPath),
      `${basename(folderPath)}${ext}`,
    );
    mkdirSync(dirname(aliasPath), { recursive: true });
    cpSync(from, aliasPath);
  });
};

// Knowing directory pages avoids a speculative 404 and preserves relative-link bases.
export const listFolderPages = (docRoot: string): string[] => {
  const walk = (dir: string, prefix: string): string[] => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .flatMap((entry) => {
        const page = prefix ? `${prefix}/${entry.name}` : entry.name;
        const hasIndex =
          tryDocFile(docRoot, `${page}/index.md`) ||
          tryDocFile(docRoot, `${page}/index.mdx`);
        return [
          ...(hasIndex ? [page] : []),
          ...walk(join(dir, entry.name), page),
        ];
      });
  };
  return walk(docRoot, '').sort();
};

const isMarkdownPath = (pathname: string): boolean => /\.mdx?$/i.test(pathname);
const decodeDocPath = (pathname: string): string | null => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
};

export const resolveDocFile = (
  docRoot: string,
  pathname: string,
): string | null => {
  const underDoc = pathname.startsWith('/doc/');
  const rel = decodeDocPath(
    underDoc ? pathname.slice('/doc/'.length) : pathname.replace(/^\//, ''),
  );
  if (rel === null) return null;
  const exact = tryDocFile(docRoot, rel);
  if (exact) return exact;
  // Only root mirrors have aliases; /doc is the verbatim source tree.
  if (underDoc || !/\.mdx?$/i.test(rel)) return null;
  const withoutExt = rel.replace(/\.mdx?$/i, '');
  if (!withoutExt || withoutExt.endsWith('/index')) return null;
  return (
    tryDocFile(docRoot, `${withoutExt}/index.md`) ??
    tryDocFile(docRoot, `${withoutExt}/index.mdx`)
  );
};

const serveMarkdown =
  (getDocRoot: () => string): Connect.NextHandleFunction =>
  (req, res, next) => {
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
    res.setHeader('Content-Type', markdownContentType);
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
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
      const dest = join(root, outDir);
      if (!existsSync(dest)) return;
      mirrorDocMarkdown(docRoot, dest);
    },
  };
};
