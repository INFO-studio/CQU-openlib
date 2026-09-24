import { describe, expect, it, vi } from 'vite-plus/test';
import {
  loadSearchResults,
  type SearchEngine,
  type SearchHit,
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
});
