import { describe, expect, it, vi } from 'vite-plus/test';
import { exactTitleToken } from '~/lib/exactTitle';
import {
  loadInitialSearchResults,
  loadSearchResults,
  mergeSearchResults,
  type SearchEngine,
  type SearchHit,
  type SearchResult,
  searchDocuments,
} from '~/lib/searchMatch';

const hit = (id: string): SearchHit => ({
  id,
  data: vi.fn(async () => ({
    url: `/course/${id}`,
    excerpt: '正文',
    meta: { title: id, page: `/course/${id}`, section: '课程' },
    sub_results: [],
  })),
});

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

  it('puts an exact title token match ahead of the ordinary ranking', async () => {
    const exact = hit('exact');
    const other = hit('other');
    const search = vi.fn(async (query: string) => ({
      results: query === exactTitleToken('大学物理') ? [exact] : [other, exact],
    }));
    const results = await searchDocuments(
      { search } as unknown as SearchEngine,
      '大学物理',
    );
    expect(results.map((item) => item.id)).toEqual(['exact', 'other']);
    expect(exact.data).not.toHaveBeenCalled();
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
