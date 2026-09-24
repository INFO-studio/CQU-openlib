import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import type { SearchEngine } from '~/lib/searchMatch';
import { loadSearchResults, searchDocuments } from '~/lib/searchMatch';
import { createSearchFiles } from '../../vite/docSearch';
import { buildSearchRecords } from '../../vite/searchContent';

let engine: SearchEngine & { destroy: () => Promise<void> };
const requests: string[] = [];

beforeAll(async () => {
  const documents = [
    {
      title: '课程A',
      path: '/course/A',
      markdown:
        '---\nplaceholder: course\nsearch:\n  keywords: [专属别名]\n  codes: [B1, B2, B3]\n---\n',
    },
    {
      title: '培养方案',
      path: '/academic/plan',
      markdown: '# 培养方案\n\nB2 B2 B2 B2\n\n## 教材\n阴文革 高等数学\n',
    },
    {
      title: '防诈骗指南',
      path: '/life/fraud',
      markdown: '## 防诈骗\n诈骗提醒 诈骗指南',
    },
    {
      title: '未激活分页',
      path: '/course/tabs',
      markdown:
        '=== "默认分页"\n\n    默认内容\n\n=== "其他分页"\n\n    多元函数 梯度 旋度 散度\n',
    },
  ];
  const files = await createSearchFiles(
    documents.flatMap((doc) =>
      buildSearchRecords(
        { ...doc, section: 'course', sectionLabel: '课程' },
        doc.markdown,
      ),
    ),
  );
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  vi.stubGlobal('document', {
    currentScript: null,
    querySelector: () => ({ getAttribute: () => 'zh-CN' }),
  });
  vi.stubGlobal('fetch', async (input: string) => {
    const path = new URL(input, 'https://search.test/').pathname.replace(
      '/pagefind/',
      '',
    );
    requests.push(path);
    const content = byPath.get(path);
    if (!content) throw new Error(`Unexpected request: ${path}`);
    return new Response(new Uint8Array(content));
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(byPath.get('pagefind.js')!).toString('base64')}`;
  engine = await import(/* @vite-ignore */ moduleUrl);
  await engine.options({
    basePath: 'https://search.test/pagefind/',
    baseUrl: '/',
    excerptLength: 24,
  } as Parameters<SearchEngine['options']>[0]);
  await engine.init();
}, 30_000);

afterAll(async () => {
  await engine?.destroy();
  vi.unstubAllGlobals();
});

describe('real Pagefind search', () => {
  it('keeps course codes searchable as fulltext fallback', async () => {
    for (const code of ['B1', 'B2', 'b2', 'B3']) {
      const result = await searchDocuments(engine, code);
      const first = await loadSearchResults(result.slice(0, 1));
      expect(first[0]).toMatchObject({
        title: '课程A',
        path: '/course/A',
        exact: false,
      });
    }
  });

  it('finds placeholders by name and custom keywords but not boilerplate or frontmatter', async () => {
    for (const query of ['课程A', '专属别名']) {
      const result = await searchDocuments(engine, query);
      expect(result.length).toBeGreaterThan(0);
      const rows = await loadSearchResults(result);
      expect(rows.some((row) => row.title === '课程A')).toBe(true);
    }
    for (const query of [
      '本门课程需要',
      'placeholder',
      'keywords',
      'updated',
    ]) {
      const result = await searchDocuments(engine, query);
      const rows = await loadSearchResults(result);
      expect(rows.some((row) => row.title === '课程A')).toBe(false);
    }
  });

  it('returns Chinese single-word matches without over-filtering', async () => {
    const result = await searchDocuments(engine, '诈骗');
    const rows = await loadSearchResults(result);
    expect(rows.map((row) => row.title)).toContain('防诈骗指南');
  });

  it('searches Chinese body content and inactive tabs without fetching document sources', async () => {
    for (const [query, title] of [
      ['阴文革', '培养方案'],
      ['梯度 散度', '未激活分页'],
    ]) {
      const result = await searchDocuments(engine, query);
      const rows = await loadSearchResults(result.slice(0, 1));
      expect(rows[0].title).toBe(title);
    }
    expect(requests.every((path) => !path.endsWith('.md'))).toBe(true);
  });
});
