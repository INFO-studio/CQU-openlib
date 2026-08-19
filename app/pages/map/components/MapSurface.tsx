import { Popover } from '@base-ui/react/popover';
import { Minus, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import { usePreferencesStore } from '~/stores/preferencesStore';
import {
  type AmapApi,
  type AmapMap,
  type AmapMarker,
  type AmapPolygon,
  type AmapStyle,
  loadAmap,
} from '../amap';
import { CAMPUS_BOUNDARIES } from '../boundaries';
import { MAP_ITEM_CATEGORY_BY_ID } from '../data';
import type { Campus, MapItem } from '../type';
import {
  applyMarkerPinHover,
  applyMarkerPinState,
  createMarkerPin,
  MARKER_PIN_SIZE,
  MARKER_SCALE,
  markerOffset,
} from '../utils/markerPin';

type MapRuntime = { api: AmapApi; map: AmapMap };
type MapStatus = 'idle' | 'loading' | 'ready' | 'error';
type MarkerEntry = {
  marker: AmapMarker;
  root: HTMLDivElement;
  listeners: {
    click: () => void;
    mouseover: () => void;
    mouseout: () => void;
  };
};
type HoverTip = { item: MapItem; x: number; y: number };

const FIRST_PAINT_TIMEOUT_MS = 2_500;
const MAP_STYLES = {
  light: 'amap://styles/normal',
  dark: 'amap://styles/grey',
} as const satisfies Record<'light' | 'dark', AmapStyle>;

const MapSurface = ({
  items,
  campus,
  selected,
  onSelect,
}: {
  items: readonly MapItem[];
  campus: Campus;
  selected: MapItem | null;
  onSelect: (item: MapItem) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef(new Map<string, MarkerEntry>());
  const activeMapRef = useRef<AmapMap | null>(null);
  const polygonsRef = useRef<{
    map: AmapMap;
    polygons: AmapPolygon[];
  } | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  const selectedRef = useRef(selected);
  const previousSelectedIdRef = useRef<string | null>(selected?.id ?? null);
  const { theme } = usePreferencesStore();
  const campusRef = useRef(campus);
  const themeRef = useRef(theme);
  const appliedThemeRef = useRef(theme);
  const centeredCampusIdRef = useRef(campus.id);
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [status, setStatus] = useState<MapStatus>('idle');
  const [retryKey, setRetryKey] = useState(0);
  const [hoverTip, setHoverTip] = useState<HoverTip | null>(null);
  const hoveredItemIdRef = useRef<string | null>(hoverTip?.item.id ?? null);
  campusRef.current = campus;
  themeRef.current = theme;
  selectedRef.current = selected;
  hoveredItemIdRef.current = hoverTip?.item.id ?? null;
  const mapReady =
    status === 'ready' &&
    runtime !== null &&
    activeMapRef.current === runtime.map;

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current === null) return;
    window.clearTimeout(hoverCloseTimerRef.current);
    hoverCloseTimerRef.current = null;
  }, []);

  const showHoverTip = useCallback(
    (item: MapItem, root: HTMLDivElement) => {
      if (!runtime || activeMapRef.current !== runtime.map) return;
      clearHoverCloseTimer();
      applyMarkerPinHover(root, true);
      const { x, y } = runtime.map.lngLatToContainer(item.coord);
      hoveredItemIdRef.current = item.id;
      setHoverTip({
        item,
        x,
        y: y - MARKER_PIN_SIZE * MARKER_SCALE.hover,
      });
    },
    [clearHoverCloseTimer, runtime],
  );

  const hideHoverTip = useCallback(
    (root: HTMLDivElement) => {
      applyMarkerPinHover(root, false);
      clearHoverCloseTimer();
      hoverCloseTimerRef.current = window.setTimeout(() => {
        hoveredItemIdRef.current = null;
        setHoverTip(null);
      }, 80);
    },
    [clearHoverCloseTimer],
  );

  useEffect(() => clearHoverCloseTimer, [clearHoverCloseTimer]);

  useEffect(() => {
    if (!runtime || !hoverTip) return;
    const map = runtime.map;
    const item = hoverTip.item;
    let frame: number | null = null;
    const sync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (activeMapRef.current !== map) return;
        const { x, y } = map.lngLatToContainer(item.coord);
        const nextY = y - MARKER_PIN_SIZE * MARKER_SCALE.hover;
        setHoverTip((previous) => {
          if (!previous || previous.item.id !== item.id) return previous;
          if (
            Math.abs(previous.x - x) < 0.5 &&
            Math.abs(previous.y - nextY) < 0.5
          ) {
            return previous;
          }
          return { item: previous.item, x, y: nextY };
        });
      });
    };
    map.on('mapmove', sync);
    map.on('zoomchange', sync);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (activeMapRef.current === map) {
        map.off('mapmove', sync);
        map.off('zoomchange', sync);
      }
    };
  }, [hoverTip?.item.id, runtime]);

  useEffect(() => {
    const container = containerRef.current;
    const key = import.meta.env.VITE_AMAP_KEY?.trim();
    if (!container) return;
    if (!key) {
      console.error('缺少 VITE_AMAP_KEY，校园地图无法初始化');
      setStatus('error');
      return;
    }

    let activeMap: AmapMap | null = null;
    let firstPaintTimer: number | undefined;
    let active = true;
    setRuntime(null);
    setStatus('loading');
    void loadAmap(key)
      .then((api) => {
        if (!active) return;
        const initialCampus = campusRef.current;
        const map = new api.Map(container, {
          center: initialCampus.center,
          zoom: initialCampus.defaultZoom,
          mapStyle: MAP_STYLES[themeRef.current],
          viewMode: '2D',
          scrollWheel: true,
        });
        activeMap = map;
        activeMapRef.current = map;
        appliedThemeRef.current = themeRef.current;
        centeredCampusIdRef.current = initialCampus.id;

        const reveal = () => {
          window.clearTimeout(firstPaintTimer);
          map.off('complete', reveal);
          if (active) setStatus('ready');
        };
        map.on('complete', reveal);
        firstPaintTimer = window.setTimeout(reveal, FIRST_PAINT_TIMEOUT_MS);
        setRuntime({ api, map });
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error(error);
        setStatus('error');
      });

    return () => {
      active = false;
      window.clearTimeout(firstPaintTimer);
      if (activeMapRef.current === activeMap) activeMapRef.current = null;
      activeMap?.destroy();
      activeMap = null;
      markersRef.current.clear();
      polygonsRef.current = null;
    };
  }, [retryKey]);

  useEffect(() => {
    if (
      !runtime ||
      activeMapRef.current !== runtime.map ||
      appliedThemeRef.current === theme
    ) {
      return;
    }
    runtime.map.setMapStyle(MAP_STYLES[theme]);
    appliedThemeRef.current = theme;
  }, [runtime, theme]);

  useEffect(() => {
    if (
      !runtime ||
      activeMapRef.current !== runtime.map ||
      centeredCampusIdRef.current === campus.id
    ) {
      return;
    }
    runtime.map.setZoomAndCenter(campus.defaultZoom, campus.center);
    centeredCampusIdRef.current = campus.id;
  }, [campus, runtime]);

  useEffect(() => {
    if (
      !runtime ||
      activeMapRef.current !== runtime.map ||
      status !== 'ready'
    ) {
      return;
    }
    const map = runtime.map;
    const polygons = (CAMPUS_BOUNDARIES[campus.id] ?? []).map(
      (path) =>
        new runtime.api.Polygon({
          path,
          fillColor: '#4069B2',
          fillOpacity: 0.08,
          strokeColor: '#4069B2',
          strokeOpacity: 0.8,
          strokeStyle: 'dashed',
          strokeWeight: 2,
          zIndex: 2,
        }),
    );
    map.add(polygons);
    polygonsRef.current = { map, polygons };
    return () => {
      if (activeMapRef.current === map) map.remove(polygons);
      if (polygonsRef.current?.polygons === polygons) {
        polygonsRef.current = null;
      }
    };
  }, [campus.id, runtime, status]);

  useEffect(() => {
    if (!runtime) return;
    markersRef.current.clear();
    previousSelectedIdRef.current = selectedRef.current?.id ?? null;
  }, [runtime]);

  useEffect(() => {
    if (!runtime || activeMapRef.current !== runtime.map) return;
    const nextIds = new Set(items.map((item) => item.id));
    for (const [id, entry] of markersRef.current) {
      if (nextIds.has(id)) continue;
      entry.marker.off('click', entry.listeners.click);
      entry.marker.off('mouseover', entry.listeners.mouseover);
      entry.marker.off('mouseout', entry.listeners.mouseout);
      runtime.map.remove(entry.marker);
      markersRef.current.delete(id);
      if (hoveredItemIdRef.current === id) {
        hoveredItemIdRef.current = null;
        setHoverTip(null);
      }
    }

    for (const item of items) {
      if (markersRef.current.has(item.id)) continue;
      const isSelected = item.id === selectedRef.current?.id;
      const root = createMarkerPin(item, isSelected);
      const marker = new runtime.api.Marker({
        position: item.coord,
        content: root,
        offset: markerOffset(runtime.api),
        zIndex: isSelected ? 120 : 10,
      });
      const listeners = {
        click: () => onSelect(item),
        mouseover: () => showHoverTip(item, root),
        mouseout: () => hideHoverTip(root),
      };
      marker.on('click', listeners.click);
      marker.on('mouseover', listeners.mouseover);
      marker.on('mouseout', listeners.mouseout);
      runtime.map.add(marker);
      markersRef.current.set(item.id, { marker, root, listeners });
    }
  }, [hideHoverTip, items, onSelect, runtime, showHoverTip]);

  useEffect(() => {
    if (!runtime || activeMapRef.current !== runtime.map) return;
    const nextSelectedId = selected?.id ?? null;
    const changedIds = new Set([previousSelectedIdRef.current, nextSelectedId]);
    for (const id of changedIds) {
      if (!id) continue;
      const entry = markersRef.current.get(id);
      if (entry) {
        const isSelected = id === nextSelectedId;
        applyMarkerPinState(entry.root, isSelected);
        entry.marker.setzIndex(isSelected ? 120 : 10);
      }
    }
    previousSelectedIdRef.current = nextSelectedId;
    if (!selected) return;
    hoveredItemIdRef.current = null;
    setHoverTip(null);
    runtime.map.panTo(selected.coord);
  }, [runtime, selected]);

  return (
    <div className="relative h-full min-w-0 overflow-hidden bg-paper [&_.amap-copyright]:z-5! [&_.amap-logo]:z-5!">
      <div
        ref={containerRef}
        className="absolute inset-0 overscroll-contain bg-paper!"
        aria-label="校园地图"
      />
      <Popover.Root open={hoverTip !== null}>
        <Popover.Trigger
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute z-20 h-px w-px"
          style={
            hoverTip
              ? { left: hoverTip.x, top: hoverTip.y }
              : { left: 0, top: 0 }
          }
        />
        <Popover.Portal>
          <Popover.Positioner
            className="pointer-events-none z-[80] outline-none"
            side="top"
            sideOffset={8}
            align="center"
          >
            <Popover.Popup className="pointer-events-none origin-[var(--transform-origin)] rounded-md border border-line bg-elev px-2.5 py-1.5 text-xs text-ink shadow-[0_8px_24px_rgba(15,23,42,0.14)] outline-none">
              {hoverTip ? (
                <div className="text-center">
                  <p className="m-0 font-medium leading-snug">
                    {hoverTip.item.name}
                  </p>
                  <p className="m-0 mt-0.5 text-[0.6875rem] text-muted">
                    {MAP_ITEM_CATEGORY_BY_ID[hoverTip.item.category].label}
                  </p>
                </div>
              ) : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {status !== 'ready' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-paper p-6">
          {status === 'error' ? (
            <div className="text-center">
              <p className="m-0 font-medium text-ink">地图暂时不可用</p>
              <button
                type="button"
                className="mt-3 h-8 rounded-md border border-line bg-panel px-3 text-xs font-medium text-ink hover:border-primary hover:text-primary"
                onClick={() => setRetryKey((key) => key + 1)}
              >
                重新加载
              </button>
            </div>
          ) : (
            <ActivitySpinner
              size={28}
              className="text-icon"
              label="地图加载中"
            />
          )}
        </div>
      ) : null}

      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-line bg-panel/92 shadow-lg backdrop-blur md:right-5 md:top-5">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center text-icon-strong hover:bg-mist disabled:cursor-not-allowed disabled:text-icon disabled:hover:bg-transparent"
          aria-label="放大地图"
          disabled={!mapReady}
          onClick={() => {
            if (runtime && activeMapRef.current === runtime.map) {
              runtime.map.zoomIn();
            }
          }}
        >
          <Plus size={17} />
        </button>
        <div className="h-px bg-line" />
        <button
          type="button"
          className="grid h-10 w-10 place-items-center text-icon-strong hover:bg-mist disabled:cursor-not-allowed disabled:text-icon disabled:hover:bg-transparent"
          aria-label="缩小地图"
          disabled={!mapReady}
          onClick={() => {
            if (runtime && activeMapRef.current === runtime.map) {
              runtime.map.zoomOut();
            }
          }}
        >
          <Minus size={17} />
        </button>
      </div>
    </div>
  );
};

export default MapSurface;
