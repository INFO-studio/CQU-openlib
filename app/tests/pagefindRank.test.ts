import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import type { SearchEngine } from '~/lib/searchMatch';
import { loadSearchResults, searchDocuments } from '~/lib/searchMatch';
import { createSearchFiles } from '../../vite/docSearch';
import { buildSearchRecords } from '../../vite/searchContent';

let engine: SearchEngine & { destroy: () => Promise<void> };

const documents = [
  {
    title: '大学物理（化工类）',
    path: '/course/phys-chem',
    markdown: '---\nplaceholder: course\n---\n',
  },
  {
    title: '大学物理',
    path: '/course/phys',
    markdown: '---\nplaceholder: course\n---\n',
  },
  {
    title: '物理学（中外合作办学）',
    path: '/academic/plan',
    markdown: `${'* [大学物理 （上）](../course/大学物理.md) - PHYS10034\n'.repeat(34)}`,
  },
  {
    title: '全国大学生物理实验竞赛',
    path: '/academic/contest',
    markdown:
      '# 全国大学生物理实验竞赛\n\n往届通知：第十二届全国大学生物理实验竞赛重庆大学校选赛。\n',
  },
];

beforeAll(async () => {
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

describe('article title ranking', () => {
  it('puts the exact article title ahead of titles that only share its words', async () => {
    const titles = (
      await loadSearchResults(await searchDocuments(engine, '大学物理'))
    ).map((row) => row.title);
    expect(titles[0]).toBe('大学物理');
    expect(titles).toContain('大学物理（化工类）');
    expect(titles).toContain('全国大学生物理实验竞赛');
    expect(titles.indexOf('大学物理（化工类）')).toBeLessThan(
      titles.indexOf('物理学（中外合作办学）'),
    );
  });
});
