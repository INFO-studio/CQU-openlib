import type { Bd09Coordinate, Building } from './data';

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
const AXIS = 6378245;
const ECCENTRICITY = 0.006693421622965943;

export const bd09ToGcj02 = ([
  longitude,
  latitude,
]: Bd09Coordinate): Coordinate => {
  const x = longitude - 0.0065;
  const y = latitude - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * PI);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * PI);
  return [z * Math.cos(theta), z * Math.sin(theta)];
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
  const [bdLongitude, bdLatitude] = building.coord;
  const [gcjLongitude, gcjLatitude] = bd09ToGcj02(building.coord);
  const [wgsLongitude, wgsLatitude] = gcj02ToWgs84([gcjLongitude, gcjLatitude]);

  return [
    {
      id: 'baidu',
      label: '百度',
      href: urlWithParams('https://api.map.baidu.com/marker', {
        location: `${bdLatitude},${bdLongitude}`,
        title: building.name,
        output: 'html',
        src: 'CQU-openlib',
      }),
    },
    {
      id: 'amap',
      label: '高德',
      href: urlWithParams('https://uri.amap.com/marker', {
        position: `${gcjLongitude},${gcjLatitude}`,
        name: building.name,
        src: 'CQU-openlib',
        coordinate: 'gaode',
        callnative: '1',
      }),
    },
    {
      id: 'tencent',
      label: '腾讯',
      href: urlWithParams('https://apis.map.qq.com/uri/v1/marker', {
        marker: `coord:${gcjLatitude},${gcjLongitude};title:${building.name}`,
        referer: 'CQU-openlib',
      }),
    },
    {
      id: 'google',
      label: 'Google',
      href: urlWithParams('https://www.google.com/maps/search/', {
        api: '1',
        query: `${wgsLatitude},${wgsLongitude}`,
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
