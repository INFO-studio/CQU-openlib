import type { Building, Gcj02Coordinate } from './data';

type Coordinate = readonly [longitude: number, latitude: number];

export type NavigationProvider =
  | 'baidu'
  | 'amap'
  | 'tencent'
  | 'google'
  | 'apple';

export type NavigationLink = {
  id: NavigationProvider;
  label: string;
  href: string;
};

const PI = Math.PI;
/** BD09 的螺旋加密用的是这个常量，不是 π。 */
const X_PI = (PI * 3000) / 180;
const AXIS = 6378245;
const ECCENTRICITY = 0.006693421622965943;

export const gcj02ToBd09 = ([
  longitude,
  latitude,
]: Gcj02Coordinate): Coordinate => {
  const z =
    Math.sqrt(longitude * longitude + latitude * latitude) +
    0.00002 * Math.sin(latitude * X_PI);
  const theta =
    Math.atan2(latitude, longitude) + 0.000003 * Math.cos(longitude * X_PI);
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006];
};

const transformLatitude = (longitude: number, latitude: number) => {
  let value =
    -100 +
    2 * longitude +
    3 * latitude +
    0.2 * latitude * latitude +
    0.1 * longitude * latitude +
    0.2 * Math.sqrt(Math.abs(longitude));
  value +=
    ((20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) *
      2) /
    3;
  value +=
    ((20 * Math.sin(latitude * PI) + 40 * Math.sin((latitude / 3) * PI)) * 2) /
    3;
  value +=
    ((160 * Math.sin((latitude / 12) * PI) +
      320 * Math.sin((latitude * PI) / 30)) *
      2) /
    3;
  return value;
};

const transformLongitude = (longitude: number, latitude: number) => {
  let value =
    300 +
    longitude +
    2 * latitude +
    0.1 * longitude * longitude +
    0.1 * longitude * latitude +
    0.1 * Math.sqrt(Math.abs(longitude));
  value +=
    ((20 * Math.sin(6 * longitude * PI) + 20 * Math.sin(2 * longitude * PI)) *
      2) /
    3;
  value +=
    ((20 * Math.sin(longitude * PI) + 40 * Math.sin((longitude / 3) * PI)) *
      2) /
    3;
  value +=
    ((150 * Math.sin((longitude / 12) * PI) +
      300 * Math.sin((longitude / 30) * PI)) *
      2) /
    3;
  return value;
};

export const gcj02ToWgs84 = ([longitude, latitude]: Coordinate): Coordinate => {
  const latitudeDelta = transformLatitude(longitude - 105, latitude - 35);
  const longitudeDelta = transformLongitude(longitude - 105, latitude - 35);
  const radianLatitude = (latitude / 180) * PI;
  const magic = 1 - ECCENTRICITY * Math.sin(radianLatitude) ** 2;
  const sqrtMagic = Math.sqrt(magic);
  const adjustedLatitude =
    (latitudeDelta * 180) /
    (((AXIS * (1 - ECCENTRICITY)) / (magic * sqrtMagic)) * PI);
  const adjustedLongitude =
    (longitudeDelta * 180) /
    ((AXIS / sqrtMagic) * Math.cos(radianLatitude) * PI);
  return [
    longitude * 2 - (longitude + adjustedLongitude),
    latitude * 2 - (latitude + adjustedLatitude),
  ];
};

const urlWithParams = (
  base: string,
  params: Record<string, string>,
): string => {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

export const navigationLinksFor = (
  building: Pick<Building, 'coord' | 'name'>,
): NavigationLink[] => {
  const [gcjLongitude, gcjLatitude] = building.coord;
  const [bdLongitude, bdLatitude] = gcj02ToBd09(building.coord);
  const [wgsLongitude, wgsLatitude] = gcj02ToWgs84(building.coord);

  return [
    {
      id: 'amap',
      label: '高德',
      // uri.amap.com/marker 和 /ssr/regeo 都只是 302 到这里，直接给终点少一跳。
      href: urlWithParams('https://ditu.amap.com/regeo', {
        lng: String(gcjLongitude),
        lat: String(gcjLatitude),
        name: building.name,
      }),
    },
    {
      id: 'baidu',
      label: '百度',
      href: urlWithParams('https://api.map.baidu.com/marker', {
        location: `${bdLatitude},${bdLongitude}`,
        title: building.name,
        content: building.name,
        output: 'html',
        src: 'webapp.INFO-studio.CQU-openlib',
      }),
    },
    {
      id: 'tencent',
      label: '腾讯',
      href: urlWithParams('https://apis.map.qq.com/uri/v1/marker', {
        marker: `coord:${gcjLatitude},${gcjLongitude};title:${building.name};addr:${building.name}`,
        referer: 'CQU-openlib',
      }),
    },
    {
      id: 'google',
      label: 'Google',
      // Google 中国的道路图同样使用 GCJ-02；转成 WGS-84 反而会偏数百米。
      // 卫星图仍是 WGS-84，这是 Google 自身两层数据不重合，外链无法兼顾。
      href: urlWithParams('https://www.google.com/maps/search/', {
        api: '1',
        query: `${gcjLatitude},${gcjLongitude}`,
      }),
    },
    {
      id: 'apple',
      label: 'Apple',
      href: urlWithParams('https://maps.apple.com/', {
        ll: `${wgsLatitude},${wgsLongitude}`,
        q: building.name,
      }),
    },
  ];
};
