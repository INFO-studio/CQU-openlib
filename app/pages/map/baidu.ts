const BAIDU_SCRIPT_ID = 'cqu-openlib-baidu-map-sdk';
const BAIDU_CALLBACK = '__cquOpenlibBaiduMapReady';

export type BaiduPoint = {
  lng: number;
  lat: number;
};

export type BaiduMap = {
  addOverlay: (overlay: unknown) => void;
  centerAndZoom: (point: BaiduPoint, zoom: number) => void;
  clearOverlays: () => void;
  enableScrollWheelZoom: (enabled?: boolean) => void;
  getZoom: () => number;
  panTo: (point: BaiduPoint) => void;
  setZoom: (zoom: number) => void;
};

export type BaiduMarker = {
  addEventListener: (event: 'click', listener: () => void) => void;
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
    const finish = () => {
      const sdk = resolveLoadedSdk();
      delete window.__cquOpenlibBaiduMapReady;
      if (sdk) {
        resolve(sdk);
      } else {
        sdkPromise = null;
        reject(new Error('百度地图 SDK 已响应，但没有提供地图对象'));
      }
    };

    window.__cquOpenlibBaiduMapReady = finish;

    const existing = document.getElementById(
      BAIDU_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('error', () => {
        sdkPromise = null;
        reject(new Error('百度地图 SDK 加载失败'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = BAIDU_SCRIPT_ID;
    script.async = true;
    script.src = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(ak)}&callback=${BAIDU_CALLBACK}`;
    script.onerror = () => {
      delete window.__cquOpenlibBaiduMapReady;
      sdkPromise = null;
      script.remove();
      reject(new Error('百度地图 SDK 加载失败'));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
};
