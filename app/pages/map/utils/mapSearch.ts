import { MAP_ITEM_CATEGORY_BY_ID } from '../data';
import type { CategoryFilter, MapItemCategory, MapSearch } from '../type';
import { isCampusId } from './campus';

type MapSearchInput = {
  campus?: unknown;
  filter?: unknown;
  focus?: unknown;
};

const isMapItemCategory = (value: unknown): value is MapItemCategory =>
  typeof value === 'string' && Object.hasOwn(MAP_ITEM_CATEGORY_BY_ID, value);

export const buildMapSearch = ({
  campus,
  filter,
  focus,
}: {
  campus?: MapSearch['campus'];
  filter?: CategoryFilter;
  focus?: MapSearch['focus'];
}): MapSearch => ({
  ...(campus ? { campus } : {}),
  ...(filter && filter !== 'all' ? { filter } : {}),
  ...(focus ? { focus } : {}),
});

export const validateMapSearch = (search: MapSearchInput): MapSearch =>
  buildMapSearch({
    campus: isCampusId(search.campus) ? search.campus : undefined,
    filter: isMapItemCategory(search.filter) ? search.filter : undefined,
    focus:
      typeof search.focus === 'string' && search.focus
        ? search.focus
        : undefined,
  });
