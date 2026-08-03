import { apiUrl } from '~/lib/apiBase';

const AMAP_SCRIPT_ID = 'cqu-openlib-amap-sdk';
const AMAP_CALLBACK = '__cquOpenlibAmapReady';
const AMAP_LOAD_TIMEOUT_MS = 15_000;

/** 高德一律 [经度, 纬度]，和百度的 Point 对象不同。 */
export type AmapPosition = readonly [longitude: number, latitude: number];

/** 内置样式，不需要在控制台建自定义样式就能用。 */
export type AmapStyle = `amap://styles/${string}`;

export type AmapMarker = {
  on: (event: 'click' | 'mouseover' | 'mouseout', listener: () => void) => void;
  setContent: (content: string | HTMLElement) => void;
  setOffset: (offset: unknown) => void;
  setzIndex: (zIndex: number) => void;
};

export type AmapPolygon = object;

export type AmapMap = {
  on: (
    event: 'complete' | 'mapmove' | 'zoomchange',
    listener: () => void,
  ) => void;
  off: (
    event: 'complete' | 'mapmove' | 'zoomchange',
    listener: () => void,
  ) => void;
  add: (overlay: unknown) => void;
  remove: (overlay: unknown) => void;
  destroy: () => void;
  getZoom: () => number;
  lngLatToContainer: (position: AmapPosition) => { x: number; y: number };
  panTo: (position: AmapPosition) => void;
  setMapStyle: (style: AmapStyle) => void;
  setZoomAndCenter: (zoom: number, center: AmapPosition) => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export type AmapApi = {
  Map: new (
    container: HTMLElement,
    options: {
      center: AmapPosition;
      zoom: number;
      mapStyle: AmapStyle;
      viewMode?: '2D' | '3D';
      scrollWheel?: boolean;
      showLabel?: boolean;
    },
  ) => AmapMap;
  Marker: new (options: {
    position: AmapPosition;
    content?: string | HTMLElement;
    icon?: unknown;
    offset?: unknown;
    title?: string;
    zIndex?: number;
  }) => AmapMarker;
  Polygon: new (options: {
    path: readonly AmapPosition[];
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: 'solid' | 'dashed';
    strokeWeight?: number;
    zIndex?: number;
  }) => AmapPolygon;
  Icon: new (options: {
    image: string;
    size: unknown;
    imageSize: unknown;
  }) => unknown;
  Size: new (width: number, height: number) => unknown;
  Pixel: new (x: number, y: number) => unknown;
};

declare global {
  interface Window {
    AMap?: AmapApi;
    _AMapSecurityConfig?: { serviceHost: string };
    __cquOpenlibAmapReady?: () => void;
  }
}

/**
 * 安全密钥由后端转发时补上，浏览器里不出现明文。一级路由必须叫 `_AMapService`，
 * SDK 会校验并弹窗，改不了。
 */
const SERVICE_HOST = apiUrl('/_AMapService');

let sdkPromise: Promise<AmapApi> | null = null;

/** key 永远会出现在 SDK 的 script URL 里，靠控制台域名白名单保护，藏不住。 */
export const loadAmap = (key: string): Promise<AmapApi> => {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<AmapApi>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      fail('高德地图 SDK 加载超时');
    }, AMAP_LOAD_TIMEOUT_MS);
    const clearPending = () => {
      window.clearTimeout(timeout);
      delete window.__cquOpenlibAmapReady;
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearPending();
      document.getElementById(AMAP_SCRIPT_ID)?.remove();
      sdkPromise = null;
      reject(new Error(message));
    };

    window.__cquOpenlibAmapReady = () => {
      if (settled) return;
      if (window.AMap) {
        settled = true;
        clearPending();
        resolve(window.AMap);
      } else {
        fail('高德地图 SDK 已响应，但没有提供地图对象');
      }
    };

    // 2021-12 之后申请的 key 都要配安全密钥，且必须在 SDK 之前挂上，晚了不生效。
    window._AMapSecurityConfig = { serviceHost: SERVICE_HOST };

    const script = document.createElement('script');
    script.id = AMAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}&callback=${AMAP_CALLBACK}`;
    script.onerror = () => fail('高德地图 SDK 加载失败');
    document.head.appendChild(script);
  });

  return sdkPromise;
};
