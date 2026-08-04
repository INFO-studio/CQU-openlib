import { Dialog } from '@base-ui/react/dialog';
import { Popover } from '@base-ui/react/popover';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ListFilter, Menu, Minus, Plus, Search, X } from 'lucide-react';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import DocLink from '~/components/DocLink';
import DocsShell from '~/components/DocsShell';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import { InfoPopover } from '~/components/ui/info-popover';
import { SelectField, type SelectOption } from '~/components/ui/select';
import { cn } from '~/lib/cn';
import { usePreferencesStore } from '~/stores/preferencesStore';
import {
  type AmapApi,
  type AmapMap,
  type AmapMarker,
  type AmapPolygon,
  type AmapStyle,
  loadAmap,
} from './amap';
import { CAMPUS_BOUNDARIES } from './boundaries';
import {
  BUILDING_CATEGORIES,
  BUILDING_CATEGORY_BY_ID,
  BUILDINGS,
  type Building,
  type BuildingCategory,
  CAMPUS_BY_ID,
  CAMPUSES,
  type Campus,
  type CampusId,
} from './data';
import { MapCategoryIcon, markerCategoryIconMarkup } from './markerIcons';
import { navigationLinksFor } from './navigation';

type MapRuntime = {
  api: AmapApi;
  map: AmapMap;
};

type MapStatus = 'idle' | 'loading' | 'ready' | 'error';
type CategoryFilter = BuildingCategory | 'all';

const CATEGORY_OPTIONS: readonly SelectOption<CategoryFilter>[] = [
  {
    value: 'all',
    label: '全部分类',
    icon: (
      <ListFilter size={14} strokeWidth={1.8} className="text-icon-strong" />
    ),
  },
  ...BUILDING_CATEGORIES.map((category) => ({
    value: category.id,
    label: category.label,
    icon: (
      <MapCategoryIcon
        category={category.id}
        size={14}
        className="text-icon-strong"
      />
    ),
  })),
];
const CAMPUS_OPTIONS: readonly SelectOption<CampusId>[] = CAMPUSES.map(
  (campus) => ({
    value: campus.id,
    label: `${campus.campusName}${campus.siteName}`,
  }),
);
const DEFAULT_CAMPUS_ID: CampusId = 'd';
/** `complete` 不来时的兜底，宁可早一点揭开也不要一直卡在占位层 */
const FIRST_PAINT_TIMEOUT_MS = 2_500;
/** 高德内置样式，省掉在控制台维护自定义样式这层。 */
const MAP_STYLES = {
  light: 'amap://styles/normal',
  dark: 'amap://styles/grey',
} as const satisfies Record<'light' | 'dark', AmapStyle>;

const isCampusId = (value: string | null): value is CampusId =>
  CAMPUSES.some((campus) => campus.id === value);

/**
 * 图钉容器固定 36×36，缩放只动内部图形，锚点才不会跟着跳。
 * hover / 选中用 transform 放大，比换整张 icon 图更顺。
 */
const MARKER_PIN_SIZE = 36;
const MARKER_SCALE = { idle: 1, hover: 1.4, selected: 1.45 } as const;

const markerPinMarkup = (category: BuildingCategory) => {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" style="display:block;filter:drop-shadow(0 1px 2px rgb(15 23 42 / .2))">
    <path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" fill="var(--c-panel)" stroke="var(--map-pin-outline,var(--c-icon))" stroke-width="1" stroke-linejoin="round" style="transition:stroke 160ms ease"/>
  </svg>${markerCategoryIconMarkup(category)}`;
};

const applyMarkerPinState = (root: HTMLDivElement, selected: boolean) => {
  const body = root.querySelector<HTMLDivElement>('[data-map-pin-body]');
  if (!body) return;
  body.dataset.selected = selected ? 'true' : 'false';
  body.style.setProperty(
    '--map-pin-outline',
    selected ? 'var(--c-primary)' : 'var(--c-icon)',
  );
  body.style.transform = `scale(${
    selected ? MARKER_SCALE.selected : MARKER_SCALE.idle
  })`;
};

const applyMarkerPinHover = (root: HTMLDivElement, hovered: boolean) => {
  const body = root.querySelector<HTMLDivElement>('[data-map-pin-body]');
  if (!body) return;
  const selected = body.dataset.selected === 'true';
  body.style.transform = `scale(${
    selected
      ? MARKER_SCALE.selected
      : hovered
        ? MARKER_SCALE.hover
        : MARKER_SCALE.idle
  })`;
};

const createMarkerPin = (
  building: Building,
  selected: boolean,
): HTMLDivElement => {
  const root = document.createElement('div');
  root.className =
    'group flex h-9 w-9 cursor-pointer items-end justify-center outline-none';
  root.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  root.style.userSelect = 'none';
  root.dataset.buildingId = building.id;

  const body = document.createElement('div');
  body.dataset.mapPinBody = 'true';
  body.dataset.selected = selected ? 'true' : 'false';
  body.style.setProperty(
    '--map-pin-outline',
    selected ? 'var(--c-primary)' : 'var(--c-icon)',
  );
  body.className =
    'relative h-9 w-9 origin-bottom transition-transform duration-200 ease-out will-change-transform';
  body.style.transform = `scale(${
    selected ? MARKER_SCALE.selected : MARKER_SCALE.idle
  })`;
  body.innerHTML = markerPinMarkup(building.category);

  root.appendChild(body);
  return root;
};

/** 图钉尖对准坐标：高德的 offset 是 content 左上角相对锚点的位移。 */
const markerOffset = (api: AmapApi) =>
  new api.Pixel(-MARKER_PIN_SIZE / 2, -MARKER_PIN_SIZE);

type MarkerEntry = {
  marker: AmapMarker;
  root: HTMLDivElement;
  listeners: {
    click: () => void;
    mouseover: () => void;
    mouseout: () => void;
  };
};

type HoverTip = {
  building: Building;
  x: number;
  y: number;
};

const MapSurface = ({
  buildings,
  campus,
  selected,
  onSelect,
}: {
  buildings: Building[];
  campus: Campus;
  selected: Building | null;
  onSelect: (building: Building) => void;
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
  const hoveredBuildingIdRef = useRef<string | null>(
    hoverTip?.building.id ?? null,
  );
  campusRef.current = campus;
  themeRef.current = theme;
  selectedRef.current = selected;
  hoveredBuildingIdRef.current = hoverTip?.building.id ?? null;
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
    (building: Building, root: HTMLDivElement) => {
      if (!runtime || activeMapRef.current !== runtime.map) return;
      clearHoverCloseTimer();
      applyMarkerPinHover(root, true);
      const { x, y } = runtime.map.lngLatToContainer(building.coord);
      hoveredBuildingIdRef.current = building.id;
      setHoverTip({
        building,
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
        hoveredBuildingIdRef.current = null;
        setHoverTip(null);
      }, 80);
    },
    [clearHoverCloseTimer],
  );

  useEffect(() => clearHoverCloseTimer, [clearHoverCloseTimer]);

  useEffect(() => {
    if (!runtime || !hoverTip) return;
    const map = runtime.map;
    const building = hoverTip.building;
    let frame: number | null = null;
    const sync = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (activeMapRef.current !== map) return;
        const { x, y } = map.lngLatToContainer(building.coord);
        const nextY = y - MARKER_PIN_SIZE * MARKER_SCALE.hover;
        setHoverTip((prev) => {
          if (!prev || prev.building.id !== building.id) return prev;
          if (Math.abs(prev.x - x) < 0.5 && Math.abs(prev.y - nextY) < 0.5) {
            return prev;
          }
          return { building: prev.building, x, y: nextY };
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
  }, [hoverTip?.building.id, runtime]);

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

        // 底图画完之前画布是空的，让占位层一直盖着，别把空画布露给用户。
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
      // WebGL 上下文和事件都挂在实例上，直接清 DOM 会漏掉这些。
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
    const nextIds = new Set(buildings.map((building) => building.id));
    for (const [id, entry] of markersRef.current) {
      if (nextIds.has(id)) continue;
      entry.marker.off('click', entry.listeners.click);
      entry.marker.off('mouseover', entry.listeners.mouseover);
      entry.marker.off('mouseout', entry.listeners.mouseout);
      runtime.map.remove(entry.marker);
      markersRef.current.delete(id);
      if (hoveredBuildingIdRef.current === id) {
        hoveredBuildingIdRef.current = null;
        setHoverTip(null);
      }
    }

    for (const building of buildings) {
      if (markersRef.current.has(building.id)) continue;
      const isSelected = building.id === selectedRef.current?.id;
      const root = createMarkerPin(building, isSelected);
      const marker = new runtime.api.Marker({
        position: building.coord,
        content: root,
        offset: markerOffset(runtime.api),
        zIndex: isSelected ? 120 : 10,
      });
      const listeners = {
        click: () => onSelect(building),
        mouseover: () => showHoverTip(building, root),
        mouseout: () => hideHoverTip(root),
      };
      marker.on('click', listeners.click);
      marker.on('mouseover', listeners.mouseover);
      marker.on('mouseout', listeners.mouseout);
      runtime.map.add(marker);
      markersRef.current.set(building.id, { marker, root, listeners });
    }
  }, [buildings, hideHoverTip, onSelect, runtime, showHoverTip]);

  useEffect(() => {
    if (!runtime || activeMapRef.current !== runtime.map) return;
    const nextSelectedId = selected?.id ?? null;
    const changedIds = new Set([previousSelectedIdRef.current, nextSelectedId]);
    for (const id of changedIds) {
      if (!id) continue;
      const entry = markersRef.current.get(id);
      const building = BUILDINGS.find((item) => item.id === id);
      if (entry && building) {
        const isSelected = id === nextSelectedId;
        applyMarkerPinState(entry.root, isSelected);
        entry.marker.setzIndex(isSelected ? 120 : 10);
      }
    }
    previousSelectedIdRef.current = nextSelectedId;
    if (!selected) return;
    hoveredBuildingIdRef.current = null;
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
                    {hoverTip.building.name}
                  </p>
                  <p className="m-0 mt-0.5 text-[0.6875rem] text-muted">
                    {BUILDING_CATEGORY_BY_ID[hoverTip.building.category].label}
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

const BuildingList = ({
  buildings,
  selected,
  onSelect,
}: {
  buildings: Building[];
  selected: Building | null;
  onSelect: (building: Building) => void;
}) => (
  <div className="min-h-0 flex-1 overflow-y-auto">
    {buildings.length ? (
      buildings.map((building) => {
        const active = selected?.id === building.id;
        return (
          <button
            type="button"
            key={building.id}
            className={cn(
              'flex w-full items-start gap-3 border-b border-line px-3 py-2.5 text-left transition-colors',
              active ? 'bg-primary-faint' : 'bg-panel hover:bg-mist',
            )}
            onClick={() => onSelect(building)}
          >
            <MapCategoryIcon
              category={building.category}
              size={17}
              className="mt-0.5 shrink-0 text-icon-strong"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug text-ink">
                {building.name}
              </span>
              {building.desc ? (
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted">
                  {building.desc}
                </span>
              ) : null}
            </span>
          </button>
        );
      })
    ) : (
      <div className="px-6 py-10 text-center">
        <ListFilter
          size={22}
          className="mx-auto text-icon-strong"
          aria-hidden
        />
        <p className="mt-3 mb-0 font-medium text-ink">没有匹配的地点</p>
        <p className="mt-1 mb-0 text-xs text-muted">换个关键词或分类试试</p>
      </div>
    )}
  </div>
);

const useDesktopLayout = () => {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isDesktop;
};

const MapSidebarContent = ({
  buildings,
  selected,
  query,
  category,
  mobile,
  onQueryChange,
  onCategoryChange,
  onSelect,
}: {
  buildings: Building[];
  selected: Building | null;
  query: string;
  category: CategoryFilter;
  mobile: boolean;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryFilter) => void;
  onSelect: (building: Building) => void;
}) => (
  <>
    {mobile ? (
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-xs font-medium text-muted">校园地点</span>
        <Dialog.Close
          className="grid h-8 w-8 place-items-center rounded-md text-icon-strong hover:bg-mist"
          aria-label="关闭地点列表"
        >
          <X size={16} />
        </Dialog.Close>
      </div>
    ) : null}
    <div className="flex gap-2 border-b border-line p-3">
      <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-paper px-3 focus-within:border-primary">
        <Search size={15} className="shrink-0 text-icon-strong" aria-hidden />
        <span className="sr-only">搜索地点</span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索"
          className="min-w-0 flex-1 text-sm placeholder:text-muted"
        />
        {query ? (
          <button
            type="button"
            className="grid h-6 w-6 place-items-center rounded-md text-icon-strong hover:bg-mist"
            aria-label="清空搜索"
            onClick={() => onQueryChange('')}
          >
            <X size={13} />
          </button>
        ) : null}
      </label>
      <SelectField
        value={category}
        options={CATEGORY_OPTIONS}
        onValueChange={onCategoryChange}
        ariaLabel="地点分类"
        className="w-32 bg-paper text-xs md:w-36"
      />
    </div>

    <BuildingList
      buildings={buildings}
      selected={selected}
      onSelect={onSelect}
    />
  </>
);

const MapPage = () => {
  const { campus: campusSearch, focus: focusId } = useSearch({ from: '/map' });
  const navigate = useNavigate({ from: '/map' });
  const isDesktop = useDesktopLayout();
  const { mapCampusId, setMapCampusId } = usePreferencesStore();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const selected = useMemo(
    () => BUILDINGS.find((building) => building.id === focusId) ?? null,
    [focusId],
  );
  const campusId =
    selected?.campusId ??
    campusSearch ??
    (isCampusId(mapCampusId) ? mapCampusId : DEFAULT_CAMPUS_ID);
  const campus = CAMPUS_BY_ID[campusId];
  const campusBuildings = useMemo(
    () => BUILDINGS.filter((building) => building.campusId === campusId),
    [campusId],
  );
  const filteredBuildings = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    return campusBuildings.filter((building) => {
      const categoryMatches =
        category === 'all' || building.category === category;
      const keywordMatches =
        !keyword ||
        `${building.name} ${building.desc}`
          .toLocaleLowerCase('zh-CN')
          .includes(keyword);
      return categoryMatches && keywordMatches;
    });
  }, [campusBuildings, category, query]);
  const markerBuildings = useDeferredValue(filteredBuildings);
  const visibleMarkerBuildings = useMemo(() => {
    if (
      !selected ||
      markerBuildings.some((building) => building.id === selected.id)
    ) {
      return markerBuildings;
    }
    return [...markerBuildings, selected];
  }, [markerBuildings, selected]);

  useEffect(() => {
    document.title = '校园地图 · CQU-openlib';
    return () => {
      document.title = 'CQU-openlib';
    };
  }, []);

  useEffect(() => {
    if (!selected && mapCampusId !== campusId) setMapCampusId(campusId);
  }, [campusId, mapCampusId, selected, setMapCampusId]);

  useEffect(() => {
    if (!selected) return;
    setMapCampusId(selected.campusId);
    setMobilePanelOpen(false);
  }, [selected, setMapCampusId]);

  const chooseCampus = (next: CampusId) => {
    setMapCampusId(next);
    void navigate({ search: { campus: next } });
    setCategory('all');
    setMobilePanelOpen(false);
  };

  const chooseBuilding = useCallback(
    (building: Building) => {
      void navigate({
        search: { campus: building.campusId, focus: building.id },
      });
      setMobilePanelOpen(false);
    },
    [navigate],
  );

  const clearSelection = () => {
    void navigate({ search: { campus: campusId } });
  };

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    if (focusId) void navigate({ search: { campus: campusId } });
  };

  const changeCategory = (nextCategory: CategoryFilter) => {
    setCategory(nextCategory);
    if (focusId) void navigate({ search: { campus: campusId } });
  };

  const navigationLinks = selected ? navigationLinksFor(selected) : [];

  return (
    <DocsShell fullBleed>
      <Dialog.Root
        open={!isDesktop && mobilePanelOpen}
        onOpenChange={setMobilePanelOpen}
      >
        <section className="h-[calc(100dvh-var(--layout-header))] min-h-[30rem] overflow-hidden bg-panel font-sans text-ink max-md:min-h-[28rem]">
          <header className="relative z-30 flex h-[3.5rem] items-center gap-3 border-b border-line bg-panel px-3 max-md:h-[3.25rem] md:px-4">
            <h1 className="m-0 shrink-0 font-display text-lg font-semibold leading-tight">
              校园地图
            </h1>

            <div className="min-w-0 flex-1">
              <SelectField
                value={campusId}
                options={CAMPUS_OPTIONS}
                onValueChange={chooseCampus}
                ariaLabel="选择校区"
                variant="compact"
                className="max-w-full rounded-md"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <InfoPopover ariaLabel="查看地图来源信息">
                <p className="m-0 leading-relaxed text-muted">
                  本页孵化自{' '}
                  <a
                    href="https://github.com/littlemana-bot/CQUMAPS"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary no-underline hover:underline"
                  >
                    CQUMAPS
                  </a>
                  <span className="mx-1 text-muted">@</span>
                  <DocLink
                    path="/contributor/Tony"
                    className="font-medium text-primary no-underline hover:underline"
                  >
                    Tony
                  </DocLink>
                </p>
                <p className="mt-2 m-0 text-[0.8125rem] leading-relaxed text-muted">
                  校园边界数据 ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary no-underline hover:underline"
                  >
                    OpenStreetMap contributors
                  </a>
                  。
                </p>
                <p className="mt-2 m-0 text-[0.8125rem] leading-relaxed text-muted">
                  地点有误、需要修改或补充请通过
                  <Link
                    to="/form/$type"
                    params={{ type: 'feedback' }}
                    search={{ page: '/map' }}
                    className="mx-1 text-primary no-underline hover:underline"
                  >
                    问题反馈
                  </Link>
                  联系我们。
                </p>
              </InfoPopover>
              <Dialog.Trigger
                className="grid h-8 w-8 place-items-center rounded-md text-icon-strong hover:bg-mist md:hidden"
                aria-label="打开地点列表"
              >
                <Menu size={18} />
              </Dialog.Trigger>
            </div>
          </header>

          <div className="relative flex h-[calc(100%-3.5rem)] min-h-[calc(30rem-3.5rem)] max-md:h-[calc(100%-3.25rem)] max-md:min-h-[calc(28rem-3.25rem)]">
            {isDesktop ? (
              <aside
                className="flex w-[21rem] shrink-0 flex-col border-r border-line bg-panel"
                aria-label="校园地点"
              >
                <MapSidebarContent
                  buildings={filteredBuildings}
                  selected={selected}
                  query={query}
                  category={category}
                  mobile={false}
                  onQueryChange={changeQuery}
                  onCategoryChange={changeCategory}
                  onSelect={chooseBuilding}
                />
              </aside>
            ) : (
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed right-0 bottom-0 left-0 top-[calc(var(--layout-header)+3.25rem)] z-50 bg-backdrop" />
                <Dialog.Popup
                  className="fixed bottom-0 left-0 top-[calc(var(--layout-header)+3.25rem)] z-51 flex w-[min(22rem,88vw)] flex-col border-r border-line bg-panel shadow-2xl outline-none"
                  aria-label="校园地点"
                >
                  <MapSidebarContent
                    buildings={filteredBuildings}
                    selected={selected}
                    query={query}
                    category={category}
                    mobile
                    onQueryChange={changeQuery}
                    onCategoryChange={changeCategory}
                    onSelect={chooseBuilding}
                  />
                </Dialog.Popup>
              </Dialog.Portal>
            )}

            <div className="relative min-w-0 flex-1">
              <MapSurface
                buildings={visibleMarkerBuildings}
                campus={campus}
                selected={selected}
                onSelect={chooseBuilding}
              />

              {!mobilePanelOpen ? (
                <Dialog.Trigger className="absolute top-3 left-3 z-10 inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel/92 px-3 text-sm font-medium text-icon-strong shadow-lg backdrop-blur md:hidden">
                  <ListFilter size={15} aria-hidden />
                  {filteredBuildings.length} 个地点
                </Dialog.Trigger>
              ) : null}

              {selected ? (
                <section className="absolute right-3 bottom-3 left-3 z-10 rounded-md border border-line bg-panel/95 p-3 shadow-2xl backdrop-blur md:right-auto md:bottom-5 md:left-5 md:w-[28rem] md:p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary bg-panel text-icon-strong">
                      <MapCategoryIcon category={selected.category} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="m-0 font-display text-lg font-semibold leading-tight">
                        {selected.name}
                      </h2>
                      {selected.desc ? (
                        <p className="mt-1 mb-0 line-clamp-2 text-xs leading-relaxed text-muted">
                          {selected.desc}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="grid h-7 w-7 shrink-0 place-items-center text-icon-strong"
                      aria-label="关闭地点详情"
                      onClick={clearSelection}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-1.5">
                    {navigationLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 items-center justify-center rounded-md border border-line bg-paper px-1 text-xs font-medium text-ink no-underline hover:border-primary hover:text-primary"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </section>
      </Dialog.Root>
    </DocsShell>
  );
};

export default MapPage;
