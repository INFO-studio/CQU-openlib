import { defaultStringifySearch } from '@tanstack/react-router';
import { describe, expect, it } from 'vite-plus/test';
import { buildMapSearch, validateMapSearch } from '~/pages/map/utils/mapSearch';

describe('map search utilities', () => {
  it('builds keys in campus-filter-focus order', () => {
    const search = buildMapSearch({
      focus: 'a_library',
      filter: 'library',
      campus: 'a',
    });
    expect(Object.keys(search)).toEqual(['campus', 'filter', 'focus']);
    expect(defaultStringifySearch(search)).toBe(
      '?campus=a&filter=library&focus=a_library',
    );
  });

  it('omits the all category and empty optional values', () => {
    expect(
      buildMapSearch({ campus: 'd', filter: 'all', focus: undefined }),
    ).toEqual({ campus: 'd' });
  });

  it('validates unknown route search values centrally', () => {
    expect(
      validateMapSearch({
        campus: 'a',
        filter: 'library',
        focus: 'a_library',
      }),
    ).toEqual({
      campus: 'a',
      filter: 'library',
      focus: 'a_library',
    });
    expect(
      validateMapSearch({
        campus: 'invalid',
        filter: 'all',
        focus: 42,
      }),
    ).toEqual({});
  });
});
