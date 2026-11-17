import { describe, expect, it, vi } from 'vite-plus/test';
import type { DocNavIndex } from '~/lib/nav';
import {
  findExactTitles,
  loadInitialSearchResults,
  loadSearchResults,
  mergeSearchResults,
  type SearchEngine,
  type SearchHit,
  type SearchResult,
  searchDocuments,
} from '~/lib/searchMatch';

const hit = (
  id: string,
  overrides: Partial<{ url: string; excerpt: string; codes: string }> = {},
): SearchHit => ({
  id,
  data: vi.fn(async () => ({
    url: overrides.url ?? `/course/${id}`,
    excerpt: overrides.excerpt ?? '正文',
    meta: {
      title: id,
      page: `/course/${id}`,
      section: '课程',
      ...(overrides.codes ? { codes: overrides.codes } : {}),
    },
    sub_results: [],
  })),
});

const sampleNavIndex: DocNavIndex = {
  generatedAt: '2026-11-17T00:00:00.000Z',
  sections: [
    {
      id: 'course',
      label: '课程',
      path: '/course',
      source: 'course',
      kind: 'dir',
      tree: [
        {
          title: '大学物理',
          path: '/course/大学物理',
          codes: ['phys10034'],
        },
        {
          title: 'Git',
          path: '/course/Git',
        },
      ],
    },
    {
      id: 'academic',
      label: '学业',
      path: '/academic',
      source: 'academic',
      kind: 'dir',
      tree: [
        {
          title: '入学必看',
          path: '/academic/入学必看/新生指南',
          matchPrefix: '/academic/入学必看',
          children: [
            {
              title: '新生指南',
              path: '/academic/入学必看/新生指南',
            },
          ],
        },
      ],
    },
    {
      id: 'sundry',
      label: '杂项',
      path: '/sundry',
      source: 'sundry',
      kind: 'dir',
      tree: [
        {
          title: '更新日志',
          path: '/sundry/更新日志',
          children: [
            {
              title: '2026-09-23',
              path: '/sundry/更新日志/2026/2026-09/2026-09-23',
            },
          ],
        },
      ],
    },
  ],
};

describe('searchMatch', () => {
  it('keeps Pagefind results lazy until their page is rendered', async () => {
    const first = hit('A');
    const second = hit('B');
    const search = vi.fn(async () => ({ results: [first, second] }));
    const result = await searchDocuments(
      { search } as unknown as SearchEngine,
      '高等数学',
    );
    expect(first.data).not.toHaveBeenCalled();
    await loadSearchResults(result.slice(0, 1));
    expect(first.data).toHaveBeenCalledOnce();
    expect(second.data).not.toHaveBeenCalled();
  });

  it('does not query the engine for whitespace', async () => {
    const search = vi.fn();
    expect(
      await searchDocuments({ search } as unknown as SearchEngine, '  '),
    ).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it('matches real page titles case-insensitively while skipping virtual folders and changelog leaves', () => {
    expect(findExactTitles(sampleNavIndex, ' 大学物理 ')).toEqual([
      {
        title: '大学物理',
        path: '/course/大学物理',
        section: '课程',
        codes: ['PHYS10034'],
      },
    ]);
    expect(
      findExactTitles(sampleNavIndex, 'git').map((item) => item.path),
    ).toEqual(['/course/Git']);
    expect(
      findExactTitles(sampleNavIndex, '首页').map((item) => item.path),
    ).toEqual(['/']);
    expect(
      findExactTitles(sampleNavIndex, '新生指南').map((item) => item.path),
    ).toEqual(['/academic/入学必看/新生指南']);
    expect(findExactTitles(sampleNavIndex, '入学必看')).toEqual([]);
    expect(
      findExactTitles(sampleNavIndex, '更新日志').map((item) => item.path),
    ).toEqual(['/sundry/更新日志']);
    expect(findExactTitles(sampleNavIndex, '2026-09-23')).toEqual([]);
  });

  it('pins an exact title match ahead of ordinary ranking while reusing fulltext excerpt', async () => {
    const other = hit('大学物理实验');
    const phys = hit('大学物理', {
      url: '/course/%E5%A4%A7%E5%AD%A6%E7%89%A9%E7%90%86#教材',
      excerpt: '大学<mark>物理</mark>教材',
      codes: 'PHYS10034 PHYS10035',
    });
    const search = vi.fn(async () => ({ results: [other, phys] }));
    const result = await loadInitialSearchResults(
      { search } as unknown as SearchEngine,
      '大学物理',
      [],
      10,
      findExactTitles(sampleNavIndex, '大学物理'),
    );
    expect(search).toHaveBeenCalledOnce();
    expect(result.results).toEqual([
      {
        id: 'title:/course/大学物理',
        path: '/course/大学物理',
        title: '大学物理',
        section: '课程',
        codes: 'PHYS10034 PHYS10035',
        excerpt: '大学<mark>物理</mark>教材',
        exact: false,
      },
      {
        id: '大学物理实验',
        path: '/course/大学物理实验',
        title: '大学物理实验',
        section: '课程',
        codes: '',
        excerpt: '正文',
        exact: false,
      },
    ]);
  });

  it('pins exact course-code matches ahead of fulltext results without hiding either', async () => {
    const exact = {
      title: '课程A',
      path: '/course/A',
      section: '课程',
      codes: ['B1'],
    };
    const fulltextHit = hit('B');
    const search = vi.fn(async () => ({ results: [fulltextHit] }));

    const result = await loadInitialSearchResults(
      { search } as unknown as SearchEngine,
      'B1',
      [exact],
      10,
    );

    expect(search).toHaveBeenCalledWith('"B1"');
    expect(result.results.map(({ title, exact }) => [title, exact])).toEqual([
      ['课程A', true],
      ['B', false],
    ]);
    expect(result.loadedHitCount).toBe(1);
  });

  it('deduplicates a fulltext hit already pinned by exact course code', () => {
    const exact: SearchResult = {
      id: 'code:/course/A',
      path: '/course/A',
      title: '课程A',
      section: '课程',
      codes: 'B1',
      excerpt: '',
      exact: true,
    };
    const fulltext: SearchResult = {
      ...exact,
      id: 'pagefind:A',
      path: '/course/%41#资源',
      excerpt: '正文命中',
      exact: false,
    };

    expect(mergeSearchResults([exact], [fulltext])).toEqual([exact]);
  });

  it('uses the original article title when the index stores a segmented one', async () => {
    const [result] = await loadSearchResults([
      {
        id: '1',
        data: async () => ({
          url: '/course/phys',
          excerpt: '',
          meta: {
            title: '大学 物理',
            label: '大学物理',
            section: '课程',
          },
          sub_results: [],
        }),
      },
    ]);
    expect(result.title).toBe('大学物理');
  });
});
