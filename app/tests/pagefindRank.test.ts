import { afterAll, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import type { DocNavIndex } from '~/lib/nav';
import type { SearchEngine } from '~/lib/searchMatch';
import {
  findExactTitles,
  loadInitialSearchResults,
  searchDocuments,
} from '~/lib/searchMatch';
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
  {
    title: '3D打印技术及应用',
    path: '/course/3d-print',
    markdown: '---\nplaceholder: course\n---\n',
  },
  {
    title: '校园网常见问题',
    path: '/academic/faq',
    markdown:
      'python 环境配置说明。\n\nQ：宿舍内的智能空调可以远程控制吗？ A：连接 Wi-Fi 后使用。\n',
  },
];

const navIndex: DocNavIndex = {
  generatedAt: '2026-11-17T00:00:00.000Z',
  sections: [
    {
      id: 'course',
      label: '课程',
      path: '/course',
      source: 'course',
      kind: 'dir',
      tree: documents.map(({ title, path }) => ({ title, path })),
    },
  ],
};

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
  vi.stubGlobal('window', globalThis);
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
    const initial = await loadInitialSearchResults(
      engine,
      '大学物理',
      [],
      10,
      findExactTitles(navIndex, '大学物理'),
    );
    const titles = initial.results.map((row) => row.title);
    expect(titles[0]).toBe('大学物理');
    expect(titles).toContain('大学物理（化工类）');
    expect(titles).toContain('全国大学生物理实验竞赛');
    expect(titles.indexOf('大学物理（化工类）')).toBeLessThan(
      titles.indexOf('物理学（中外合作办学）'),
    );
  });

  it('does not leak unrelated Q matches when searching a term without an exact title', async () => {
    await searchDocuments(engine, 'python');
    const initial = await loadInitialSearchResults(
      engine,
      '打印',
      [],
      10,
      findExactTitles(navIndex, '打印'),
    );
    expect(initial.results.map((row) => row.title)).toEqual([
      '3D打印技术及应用',
    ]);
  });
});
