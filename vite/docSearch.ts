import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createIndex, type IndexFile } from 'pagefind';
import { tsImport } from 'tsx/esm/api';
import type { Plugin } from 'vite';
import {
  type CourseCodeSearchChunk,
  courseCodeBucket,
  normalizeCourseCode,
} from '../app/lib/courseCodeSearch';
import { buildDocNavIndex } from './docNavIndex';
import type { SearchRecord } from './searchContent';

export const createSearchFiles = async (
  records: SearchRecord[],
): Promise<IndexFile[]> => {
  const { index, errors } = await createIndex({ forceLanguage: 'zh' });
  if (!index) throw new Error(errors.join('\n'));
  try {
    for (const record of records) {
      const result = await index.addHTMLFile(record);
      if (result.errors.length)
        throw new Error(`${record.url}: ${result.errors.join('\n')}`);
    }
    const result = await index.getFiles();
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    return result.files.filter(
      (file) =>
        !file.path.startsWith('pagefind-ui.') &&
        !file.path.startsWith('pagefind-component-ui.'),
    );
  } finally {
    await index.deleteIndex();
  }
};

export const docSearchPlugin = (): Plugin => {
  let root = '';
  let building = false;
  let files: IndexFile[] = [];
  let courseCodeChunks = new Map<string, string>();
  let fingerprint = '';
  let pending = Promise.resolve();
  const rebuild = async () => {
    // Vite's config loader runs before the app's TypeScript path aliases exist.
    const { buildSearchRecords, recordFingerprint, searchMetadata } =
      (await tsImport(pathToFileURL(join(root, 'vite/searchContent.ts')).href, {
        parentURL: import.meta.url,
        tsconfig: join(root, 'tsconfig.json'),
      })) as typeof import('./searchContent');
    const { documents } = buildDocNavIndex(join(root, 'public', 'doc'), root);
    const chunks = new Map<string, CourseCodeSearchChunk>();
    const records = documents.flatMap((doc) => {
      try {
        const markdown = doc.file ? readFileSync(doc.file, 'utf8') : '';
        const metadata = searchMetadata(markdown);
        const codes = [
          ...new Set(
            [...(doc.codes ?? []), ...metadata.codes].map(normalizeCourseCode),
          ),
        ];
        for (const code of codes) {
          const bucket = courseCodeBucket(code);
          const chunk = chunks.get(bucket) ?? {};
          const entries = chunk[code] ?? [];
          entries.push({
            title: doc.title,
            path: doc.path,
            section: doc.sectionLabel,
            codes: codes.map((value) => value.toUpperCase()),
          });
          chunk[code] = entries;
          chunks.set(bucket, chunk);
        }
        return buildSearchRecords(doc, markdown);
      } catch (error) {
        throw new Error(`${doc.file ?? doc.path}: ${String(error)}`, {
          cause: error,
        });
      }
    });
    courseCodeChunks = new Map(
      [...chunks].map(([bucket, chunk]) => [bucket, JSON.stringify(chunk)]),
    );
    const next = recordFingerprint(records);
    if (next === fingerprint) return;
    const generated = await createSearchFiles(records);
    files = generated;
    fingerprint = next;
    console.info(
      `[doc-search] ${records.length} records, ${generated.length} files`,
    );
  };
  return {
    name: 'doc-search',
    configResolved(config) {
      root = config.root;
      building = config.command === 'build' && config.mode !== 'test';
    },
    async buildStart() {
      if (building) await rebuild();
    },
    generateBundle() {
      for (const [bucket, source] of courseCodeChunks) {
        this.emitFile({
          type: 'asset',
          fileName: `search/codes/${bucket}.json`,
          source,
        });
      }
      for (const file of files) {
        this.emitFile({
          type: 'asset',
          fileName: `search/pagefind/${file.path}`,
          source: file.content,
        });
      }
    },
    configureServer(server) {
      if (server.config.mode === 'test') return;
      pending = rebuild();
      pending.catch((error) => server.config.logger.error(String(error)));
      server.middlewares.use('/search/codes', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        await pending;
        const bucket = (req.url ?? '')
          .split('?')[0]
          .replace(/^\//, '')
          .replace(/\.json$/, '');
        const source = courseCodeChunks.get(bucket);
        if (!source) {
          res.statusCode = 404;
          res.end('NOT_FOUND');
          return;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(req.method === 'HEAD' ? undefined : source);
      });
      server.middlewares.use('/search/pagefind', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        try {
          await pending;
          const path = (req.url ?? '').split('?')[0].replace(/^\//, '');
          const file = files.find((entry) => entry.path === path);
          if (!file) {
            res.statusCode = 404;
            res.end('NOT_FOUND');
            return;
          }
          res.setHeader(
            'Content-Type',
            path.endsWith('.js')
              ? 'text/javascript; charset=utf-8'
              : path.endsWith('.json')
                ? 'application/json'
                : 'application/octet-stream',
          );
          res.setHeader('Cache-Control', 'no-cache');
          res.end(req.method === 'HEAD' ? undefined : file.content);
        } catch (error) {
          res.statusCode = 503;
          res.end(String(error));
        }
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onChange = (_event: string, file: string) => {
        const doc =
          file.startsWith(join(root, 'public', 'doc')) && /\.mdx?$/i.test(file);
        if (!doc && file !== join(root, 'metadata', 'course-codes.json'))
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          pending = pending.catch(() => {}).then(rebuild);
          pending
            .then(() => server.ws.send({ type: 'full-reload' }))
            .catch((error) => server.config.logger.error(String(error)));
        }, 250);
      };
      server.watcher.on('all', onChange);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        server.watcher.off('all', onChange);
      });
    },
  };
};
