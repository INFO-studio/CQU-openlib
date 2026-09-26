import { type ChildProcess, fork } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deserialize, serialize } from 'node:v8';
import { createIndex, type IndexFile } from 'pagefind';
import { tsImport } from 'tsx/esm/api';
import type { Plugin, ViteDevServer } from 'vite';
import {
  type CourseCodeSearchChunk,
  courseCodeBucket,
  normalizeCourseCode,
} from '../app/lib/courseCodeSearch';
import { buildDocNavIndex } from './docNavIndex';
import type { SearchRecord } from './searchContent';

const searchCacheVersion = 1 as const;

export type SearchCache = {
  version: typeof searchCacheVersion;
  fingerprint: string;
  recordCount: number;
  files: IndexFile[];
  courseCodeChunks: [string, string][];
};

type SearchCacheBuild = {
  cache: SearchCache | null;
  recordCount: number;
};

export type SearchRefreshResult = {
  changed: boolean;
  recordCount: number;
  fileCount: number;
};

type SearchWorkerMessage =
  | { type: 'complete'; result: SearchRefreshResult }
  | { type: 'error'; message: string };

export const searchCacheFile = (root: string): string =>
  join(root, 'node_modules', '.cache', 'cqu-openlib', 'doc-search.bin');

const isIndexFile = (value: unknown): value is IndexFile => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<IndexFile>;
  return (
    typeof candidate.path === 'string' &&
    candidate.content instanceof Uint8Array
  );
};

const isCourseCodeChunk = (value: unknown): value is [string, string] =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((part) => typeof part === 'string');

const isSearchCache = (value: unknown): value is SearchCache => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<SearchCache>;
  return (
    candidate.version === searchCacheVersion &&
    typeof candidate.fingerprint === 'string' &&
    typeof candidate.recordCount === 'number' &&
    Array.isArray(candidate.files) &&
    candidate.files.every(isIndexFile) &&
    Array.isArray(candidate.courseCodeChunks) &&
    candidate.courseCodeChunks.every(isCourseCodeChunk)
  );
};

export const readSearchCache = (root: string): SearchCache | null => {
  const file = searchCacheFile(root);
  if (!existsSync(file)) return null;
  try {
    const cache: unknown = deserialize(readFileSync(file));
    return isSearchCache(cache) ? cache : null;
  } catch {
    return null;
  }
};

export const writeSearchCache = (root: string, cache: SearchCache): void => {
  const file = searchCacheFile(root);
  const temporary = `${file}.${process.pid}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(temporary, serialize(cache));
    renameSync(temporary, file);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
};

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

const buildSearchCache = async (
  root: string,
  previousFingerprint?: string,
): Promise<SearchCacheBuild> => {
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
      codes.forEach((code) => {
        const bucket = courseCodeBucket(code);
        const chunk = chunks.get(bucket) ?? {};
        const entries = chunk[code] ?? [];
        chunk[code] = [
          ...entries,
          {
            title: doc.title,
            path: doc.path,
            section: doc.sectionLabel,
            codes: codes.map((value) => value.toUpperCase()),
          },
        ];
        chunks.set(bucket, chunk);
      });
      return buildSearchRecords(doc, markdown);
    } catch (error) {
      throw new Error(`${doc.file ?? doc.path}: ${String(error)}`, {
        cause: error,
      });
    }
  });
  const fingerprint = recordFingerprint(records);
  if (fingerprint === previousFingerprint) {
    return { cache: null, recordCount: records.length };
  }
  const files = await createSearchFiles(records);
  return {
    cache: {
      version: searchCacheVersion,
      fingerprint,
      recordCount: records.length,
      files,
      courseCodeChunks: [...chunks].map(([bucket, chunk]) => [
        bucket,
        JSON.stringify(chunk),
      ]),
    },
    recordCount: records.length,
  };
};

export const refreshSearchCache = async (
  root: string,
): Promise<SearchRefreshResult> => {
  const previous = readSearchCache(root);
  const built = await buildSearchCache(root, previous?.fingerprint);
  if (!built.cache) {
    return {
      changed: false,
      recordCount: built.recordCount,
      fileCount: previous?.files.length ?? 0,
    };
  }
  writeSearchCache(root, built.cache);
  return {
    changed: true,
    recordCount: built.cache.recordCount,
    fileCount: built.cache.files.length,
  };
};

const isSearchWorkerMessage = (
  value: unknown,
): value is SearchWorkerMessage => {
  if (typeof value !== 'object' || value === null || !('type' in value))
    return false;
  const message = value as Partial<SearchWorkerMessage>;
  if (message.type === 'error') return typeof message.message === 'string';
  if (message.type !== 'complete' || !message.result) return false;
  return (
    typeof message.result.changed === 'boolean' &&
    typeof message.result.recordCount === 'number' &&
    typeof message.result.fileCount === 'number'
  );
};

const runSearchWorker = (
  root: string,
  activeChildren: Set<ChildProcess>,
): Promise<SearchRefreshResult> =>
  new Promise((resolve, reject) => {
    const child = fork(join(root, 'vite', 'docSearchWorker.ts'), [root], {
      cwd: root,
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    activeChildren.add(child);
    // Multiple process events may race; only the first terminal event settles.
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    child.once('message', (value) => {
      if (!isSearchWorkerMessage(value)) return;
      if (value.type === 'error') {
        settle(() => reject(new Error(value.message)));
        return;
      }
      settle(() => resolve(value.result));
    });
    child.once('error', (error) => settle(() => reject(error)));
    child.once('exit', (code, signal) => {
      activeChildren.delete(child);
      settle(() =>
        reject(
          new Error(
            `搜索索引进程异常退出（code=${String(code)}, signal=${String(signal)}）`,
          ),
        ),
      );
    });
  });

const loadGeneratedCache = async (
  root: string,
  activeChildren: Set<ChildProcess>,
): Promise<{ cache: SearchCache; result: SearchRefreshResult }> => {
  const result = await runSearchWorker(root, activeChildren);
  const cache = readSearchCache(root);
  if (!cache) throw new Error('搜索索引进程完成后未找到有效缓存');
  return { cache, result };
};

export const docSearchPlugin = (): Plugin => {
  let root = '';
  let building = false;
  let files: IndexFile[] = [];
  let filesByPath = new Map<string, Uint8Array>();
  let courseCodeChunks = new Map<string, string>();
  let fingerprint = '';
  let pending = Promise.resolve();
  let closing = false;
  const activeChildren = new Set<ChildProcess>();

  const applyCache = (cache: SearchCache) => {
    files = cache.files;
    filesByPath = new Map(
      cache.files.map((file) => [file.path, file.content] as const),
    );
    courseCodeChunks = new Map(cache.courseCodeChunks);
    fingerprint = cache.fingerprint;
  };

  const logCache = (
    server: ViteDevServer,
    label: 'cache hit' | 'cache refreshed' | 'cache unchanged',
    cache: SearchCache,
  ) => {
    server.config.logger.info(
      `[doc-search] ${label}: ${cache.recordCount} records, ${cache.files.length} files`,
    );
  };

  const installDevRuntime = (
    server: ViteDevServer,
    refreshAfterListen: boolean,
  ) => {
    const queueRefresh = (reload: boolean) => {
      pending = pending
        .catch(() => {})
        .then(async () => {
          const previousFingerprint = fingerprint;
          const { cache, result } = await loadGeneratedCache(
            root,
            activeChildren,
          );
          applyCache(cache);
          logCache(
            server,
            result.changed ? 'cache refreshed' : 'cache unchanged',
            cache,
          );
          if (reload && result.changed && fingerprint !== previousFingerprint) {
            server.ws.send({ type: 'full-reload' });
          }
        });
      pending.catch((error) => {
        if (!closing) server.config.logger.error(String(error));
      });
    };

    server.middlewares.use('/search/codes', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
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
    server.middlewares.use('/search/pagefind', (req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      const path = (req.url ?? '').split('?')[0].replace(/^\//, '');
      const content = filesByPath.get(path);
      if (!content) {
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
      res.end(req.method === 'HEAD' ? undefined : content);
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (_event: string, file: string) => {
      const doc =
        file.startsWith(join(root, 'public', 'doc')) && /\.mdx?$/i.test(file);
      if (!doc && file !== join(root, 'metadata', 'course-codes.json')) return;
      clearTimeout(timer);
      timer = setTimeout(() => queueRefresh(true), 250);
    };
    server.watcher.on('all', onChange);
    if (refreshAfterListen) {
      server.httpServer?.once('listening', () => queueRefresh(true));
    }
    server.httpServer?.once('close', () => {
      closing = true;
      clearTimeout(timer);
      server.watcher.off('all', onChange);
      activeChildren.forEach((child) => {
        child.kill();
      });
    });
  };

  return {
    name: 'doc-search',
    configResolved(config) {
      root = config.root;
      building = config.command === 'build' && config.mode !== 'test';
    },
    async buildStart() {
      if (!building) return;
      const built = await buildSearchCache(root);
      if (!built.cache) throw new Error('生产搜索索引未生成');
      applyCache(built.cache);
      console.info(
        `[doc-search] ${built.cache.recordCount} records, ${built.cache.files.length} files`,
      );
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
    async configureServer(server) {
      if (server.config.mode === 'test') return;
      const cached = readSearchCache(root);
      if (cached) {
        applyCache(cached);
        logCache(server, 'cache hit', cached);
        installDevRuntime(server, true);
        return;
      }
      server.config.logger.info('[doc-search] cache missing; building index');
      const generated = await loadGeneratedCache(root, activeChildren);
      applyCache(generated.cache);
      logCache(server, 'cache refreshed', generated.cache);
      installDevRuntime(server, false);
    },
  };
};
