import type {
  Campus,
  CampusId,
  MapItem,
  MapItemCategory,
  MapItemCategoryDefinition,
} from '../type';

export type {
  Campus,
  CampusId,
  Gcj02Coordinate,
  MapItem,
  MapItemCategory,
  MapItemCategoryDefinition,
  MapItemComment,
} from '../type';

export const MAP_ITEM_CATEGORIES = [
  {
    id: 'teaching',
    label: '教学楼',
  },
  {
    id: 'dormitory',
    label: '学生宿舍',
  },
  {
    id: 'canteen',
    label: '食堂',
  },
  {
    id: 'library',
    label: '图书馆',
  },
  {
    id: 'sports',
    label: '运动场馆',
  },
  {
    id: 'admin',
    label: '行政楼',
  },
  {
    id: 'gate',
    label: '校门',
  },
  {
    id: 'hospital',
    label: '校医院',
  },
  {
    id: 'theater',
    label: '剧场',
  },
  {
    id: 'bus_station',
    label: '校车站',
  },
  {
    id: 'transit',
    label: '公共交通',
  },
  {
    id: 'landmark',
    label: '地标建筑',
  },
  {
    id: 'college',
    label: '学院楼',
  },
  {
    id: 'food',
    label: '附近美食',
  },
  {
    id: 'express',
    label: '快递点',
  },
] as const satisfies readonly MapItemCategoryDefinition[];

export const CAMPUSES = [
  {
    id: 'd',
    campusName: '科学城校区',
    siteName: '虎溪校园',
    center: [106.2982, 29.593145],
    defaultZoom: 16,
  },
  {
    id: 'a',
    campusName: '沙坪坝校区',
    siteName: 'A校园',
    center: [106.469183, 29.564402],
    defaultZoom: 16,
  },
  {
    id: 'b',
    campusName: '沙坪坝校区',
    siteName: 'B校园',
    center: [106.458901, 29.567418],
    defaultZoom: 16,
  },
  {
    id: 'c',
    campusName: '沙坪坝校区',
    siteName: 'C校园',
    center: [106.453622, 29.560272],
    defaultZoom: 16,
  },
  {
    id: 'e',
    campusName: '两江校区',
    siteName: '卓越工程师学院',
    center: [106.809205, 29.73923],
    defaultZoom: 17,
  },
] as const satisfies readonly Campus[];

export const CAMPUS_BY_ID = Object.fromEntries(
  CAMPUSES.map((campus) => [campus.id, campus]),
) as Readonly<Record<CampusId, Campus>>;

export const MAP_ITEM_CATEGORY_BY_ID = Object.fromEntries(
  MAP_ITEM_CATEGORIES.map((category) => [category.id, category]),
) as unknown as Readonly<Record<MapItemCategory, MapItemCategoryDefinition>>;

type CampusItemsModule = {
  default: readonly MapItem[];
};

const CAMPUS_ITEM_LOADERS: Readonly<
  Record<CampusId, () => Promise<CampusItemsModule>>
> = {
  a: () => import('./a'),
  b: () => import('./b'),
  c: () => import('./c'),
  d: () => import('./d'),
  e: () => import('./e'),
};

export const loadCampusItems = async (
  campusId: CampusId,
): Promise<readonly MapItem[]> =>
  (await CAMPUS_ITEM_LOADERS[campusId]()).default;

export const loadAllMapItems = async (): Promise<readonly MapItem[]> => {
  const campusItems = await Promise.all(
    CAMPUSES.map((campus) => loadCampusItems(campus.id)),
  );

  return campusItems.flat();
};
