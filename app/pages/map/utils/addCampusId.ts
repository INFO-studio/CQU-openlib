import type { CampusId, MapItem } from '../type';

const addCampusId = (
  campusId: CampusId,
  items: readonly Omit<MapItem, 'campusId'>[],
): readonly MapItem[] => {
  return items.map((item) => ({ ...item, campusId }));
};

export default addCampusId;
