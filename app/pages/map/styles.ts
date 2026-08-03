import type { BaiduMapStyleRule } from './baidu';

/**
 * 底图配色对齐 app/theme/colors.ts：paper / panel / ink 换算成 sRGB 后再向地图
 * 语义色偏移，避免地图和站点像两套设计。百度只接受 #rrggbbaa 字面量。
 */
type MapPalette = {
  land: string;
  water: string;
  green: string;
  campus: string;
  medical: string;
  building: string;
  buildingStroke: string;
  local: string;
  arterial: string;
  highway: string;
  roadStroke: string;
  railway: string;
  /** 行政区、城市、乡镇 */
  labelStrong: string;
  /** POI */
  labelBase: string;
  /** 道路、轨道 */
  labelWeak: string;
  /** 文字描边取底图色，只用来托住文字，不制造光晕 */
  labelHalo: string;
};

const LIGHT_PALETTE: MapPalette = {
  land: '#f2f4f8ff',
  water: '#cfe0eeff',
  green: '#dfe9d8ff',
  campus: '#e8ecf7ff',
  medical: '#f3eaebff',
  building: '#e6e8eeff',
  buildingStroke: '#d8dbe4ff',
  local: '#ffffffff',
  arterial: '#ffffffff',
  highway: '#f5e0b4ff',
  roadStroke: '#e0e4ecff',
  railway: '#c9cdd8ff',
  labelStrong: '#3a4356ff',
  labelBase: '#5c6577ff',
  labelWeak: '#737b8cff',
  labelHalo: '#f2f4f8d9',
};

const DARK_PALETTE: MapPalette = {
  land: '#10151fff',
  water: '#0d1a26ff',
  green: '#14261dff',
  campus: '#182236ff',
  medical: '#231d26ff',
  building: '#1a2130ff',
  buildingStroke: '#232c3dff',
  local: '#262e3dff',
  arterial: '#2e3746ff',
  highway: '#3d3a2eff',
  roadStroke: '#1a2130ff',
  railway: '#333b49ff',
  labelStrong: '#c7cedeff',
  labelBase: '#98a2b5ff',
  labelWeak: '#828c9eff',
  labelHalo: '#10151fd9',
};

const surface = (
  featureType: string,
  fill: string,
  stroke = fill,
): BaiduMapStyleRule[] => [
  { featureType, elementType: 'geometry.fill', stylers: { color: fill } },
  { featureType, elementType: 'geometry.stroke', stylers: { color: stroke } },
];

const labels = (
  featureTypes: readonly string[],
  color: string,
  halo: string,
): BaiduMapStyleRule[] =>
  featureTypes.flatMap((featureType) => [
    { featureType, elementType: 'labels.text.fill', stylers: { color } },
    {
      featureType,
      elementType: 'labels.text.stroke',
      stylers: { color: halo },
    },
  ]);

const DISTRICT_LABELS = [
  'continent',
  'province',
  'city',
  'town',
  'district',
  'districtlabel',
] as const;

/** `all` 兜不住时的显式清单，覆盖校园周边最常出现的 POI 类别 */
const POI_LABELS = [
  'poilabel',
  'education',
  'medical',
  'scenicspots',
  'shopping',
  'entertainment',
  'manmade',
  'estate',
  'business',
  'life',
  'transportation',
  'subwaystation',
] as const;

const ROAD_LABELS = [
  'road',
  'highway',
  'arterial',
  'local',
  'railway',
  'subway',
] as const;

const createMapStyle = (palette: MapPalette): BaiduMapStyleRule[] => [
  // 先给所有要素定基调，未逐个列出的 POI 类别才不会漏回百度默认的白色描边。
  ...labels(['all'], palette.labelBase, palette.labelHalo),

  ...surface('land', palette.land),
  ...surface('water', palette.water),
  ...surface('green', palette.green),
  ...surface('scenicspots', palette.green),
  ...surface('education', palette.campus, palette.buildingStroke),
  ...surface('medical', palette.medical, palette.buildingStroke),
  ...surface('building', palette.building, palette.buildingStroke),
  ...surface('manmade', palette.building, palette.buildingStroke),
  ...surface('shopping', palette.building, palette.buildingStroke),
  ...surface('entertainment', palette.building, palette.buildingStroke),

  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: { visibility: 'on' },
  },
  ...surface('road', palette.local, palette.roadStroke),
  ...surface('local', palette.local, palette.roadStroke),
  ...surface('arterial', palette.arterial, palette.roadStroke),
  ...surface('highway', palette.highway, palette.roadStroke),
  ...surface('railway', palette.railway, palette.roadStroke),
  ...surface('subway', palette.railway, palette.roadStroke),

  ...labels(POI_LABELS, palette.labelBase, palette.labelHalo),
  ...labels(DISTRICT_LABELS, palette.labelStrong, palette.labelHalo),
  ...labels(ROAD_LABELS, palette.labelWeak, palette.labelHalo),
];

export const BAIDU_MAP_STYLES = {
  light: createMapStyle(LIGHT_PALETTE),
  dark: createMapStyle(DARK_PALETTE),
} satisfies Record<'light' | 'dark', BaiduMapStyleRule[]>;
