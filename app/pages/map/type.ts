/**
 * a-d：沙坪坝 A、B、C 校园与科学城虎溪校园；e：两江校区。
 */
export type CampusId = 'a' | 'b' | 'c' | 'd' | 'e';

export type MapItemCategory =
  | 'teaching'
  | 'dormitory'
  | 'canteen'
  | 'library'
  | 'sports'
  | 'admin'
  | 'gate'
  | 'hospital'
  | 'theater'
  | 'bus_station'
  | 'transit'
  | 'landmark'
  | 'college'
  | 'food'
  | 'express';

export type CategoryFilter = MapItemCategory | 'all';
export type CampusDataStatus = 'loading' | 'ready' | 'error';

export type MapSearch = {
  campus?: CampusId;
  filter?: MapItemCategory;
  focus?: string;
};

/**
 * 高德 GCJ-02 坐标，依次为经度、纬度。
 */
export type Gcj02Coordinate = readonly [longitude: number, latitude: number];

export type Campus = {
  readonly id: CampusId;
  readonly campusName: string;
  readonly siteName: string;
  readonly center: Gcj02Coordinate;
  /** 初始缩放级别；数值越大，视野越近。 */
  readonly defaultZoom: number;
};

export type MapItemComment = {
  /** 评分范围为 0–10。 */
  readonly rate?: number;
  readonly author?: string;
  readonly detail: string;
};

export type MapItem = {
  readonly id: string;
  readonly name: string;
  readonly category: MapItemCategory;
  readonly campusId: CampusId;
  readonly coord: Gcj02Coordinate;
  readonly desc?: string;
  readonly comment?: readonly MapItemComment[];
};

export type MapItemCategoryDefinition = {
  readonly id: MapItemCategory;
  readonly label: string;
};
