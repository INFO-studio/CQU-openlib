const BAIDU_SCRIPT_ID = 'cqu-openlib-baidu-map-sdk';
const BAIDU_CALLBACK = '__cquOpenlibBaiduMapReady';
const BAIDU_LOAD_TIMEOUT_MS = 15_000;

export type BaiduPoint = {
  lng: number;
  lat: number;
};

export type BaiduMapStyleRule = {
  featureType: string;
  elementType: string;
  stylers: Record<string, string | number>;
};

export type BaiduMap = {
  addEventListener: (event: 'tilesloaded', listener: () => void) => void;
  removeEventListener: (event: 'tilesloaded', listener: () => void) => void;
  addOverlay: (overlay: unknown) => void;
  centerAndZoom: (point: BaiduPoint, zoom: number) => void;
  clearOverlays: () => void;
  enableContinuousZoom: () => void;
  enableDragging: () => void;
  enableInertialDragging: () => void;
  enablePinchToZoom: () => void;
  enableScrollWheelZoom: (enabled?: boolean) => void;
  getZoom: () => number;
  panTo: (point: BaiduPoint) => void;
  removeOverlay: (overlay: unknown) => void;
  setMapStyleV2: (style: { styleJson: BaiduMapStyleRule[] }) => void;
  setZoom: (zoom: number) => void;
};

export type BaiduMarker = {
  addEventListener: (event: 'click', listener: () => void) => void;
  setIcon: (icon: unknown) => void;
};

export type BaiduApi = {
  Map: new (
    container: HTMLElement,
    options?: { enableMapClick?: boolean },
  ) => BaiduMap;
  Point: new (lng: number, lat: number) => BaiduPoint;
  Marker: new (
    point: BaiduPoint,
    options?: { icon?: unknown; title?: string },
  ) => BaiduMarker;
  Icon: new (
    imageUrl: string,
    size: unknown,
    options?: { anchor?: unknown; imageSize?: unknown },
  ) => unknown;
  Size: new (width: number, height: number) => unknown;
};

declare global {
  interface Window {
    BMap?: BaiduApi;
    __cquOpenlibBaiduMapReady?: () => void;
  }
}

let sdkPromise: Promise<BaiduApi> | null = null;

const resolveLoadedSdk = (): BaiduApi | null => window.BMap ?? null;

export const loadBaiduMap = (ak: string): Promise<BaiduApi> => {
  const loaded = resolveLoadedSdk();
  if (loaded) return Promise.resolve(loaded);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<BaiduApi>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      fail('百度地图 SDK 加载超时');
    }, BAIDU_LOAD_TIMEOUT_MS);
    const clearPending = () => {
      window.clearTimeout(timeout);
      delete window.__cquOpenlibBaiduMapReady;
    };
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      clearPending();
      document.getElementById(BAIDU_SCRIPT_ID)?.remove();
      sdkPromise = null;
      reject(new Error(message));
    };
    const finish = () => {
      if (settled) return;
      const sdk = resolveLoadedSdk();
      if (sdk) {
        settled = true;
        clearPending();
        resolve(sdk);
      } else {
        fail('百度地图 SDK 已响应，但没有提供地图对象');
      }
    };

    window.__cquOpenlibBaiduMapReady = finish;

    const existing = document.getElementById(
      BAIDU_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('error', () => fail('百度地图 SDK 加载失败'), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = BAIDU_SCRIPT_ID;
    script.async = true;
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(ak)}&callback=${BAIDU_CALLBACK}`;
    script.onerror = () => fail('百度地图 SDK 加载失败');
    document.head.appendChild(script);
  });

  return sdkPromise;
};
