import { CAMPUSES } from '../data';
import type { CampusId } from '../type';

export const isCampusId = (value: unknown): value is CampusId =>
  typeof value === 'string' && CAMPUSES.some((campus) => campus.id === value);

export const campusIdFromMapItemId = (
  itemId: string | undefined,
): CampusId | null => {
  if (!itemId) return null;
  const prefix = itemId.split('_', 1)[0];
  if (prefix === 'huxi') return 'd';
  return isCampusId(prefix) ? prefix : null;
};
