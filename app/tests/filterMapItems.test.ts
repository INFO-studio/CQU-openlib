import { describe, expect, it } from 'vite-plus/test';
import type { MapItem } from '~/pages/map/type';
import { filterMapItems } from '~/pages/map/utils/filterMapItems';

const items: readonly MapItem[] = [
  {
    id: 'a_library',
    name: '图书馆',
    category: 'library',
    campusId: 'a',
    coord: [106.4, 29.5],
    desc: '自习与借阅',
    comment: [{ author: 'Tony', detail: '安静', rate: 9 }],
  },
  {
    id: 'a_canteen',
    name: '食堂',
    category: 'canteen',
    campusId: 'a',
    coord: [106.41, 29.51],
  },
];

describe('filterMapItems', () => {
  it('filters map items by category without mutating source data', () => {
    expect(filterMapItems(items, 'library', '')).toEqual([items[0]]);
    expect(items).toHaveLength(2);
  });

  it('matches names, descriptions, comments, authors and ratings', () => {
    for (const query of ['图书', '自习', 'tony', '安静', '9']) {
      expect(filterMapItems(items, 'all', query)).toEqual([items[0]]);
    }
  });

  it('combines category and trimmed case-insensitive query', () => {
    expect(filterMapItems(items, 'canteen', ' 食堂 ')).toEqual([items[1]]);
    expect(filterMapItems(items, 'library', '食堂')).toEqual([]);
  });
});
