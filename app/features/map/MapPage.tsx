import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Building2,
  Compass,
  ListFilter,
  MapPin,
  Menu,
  Minus,
  Navigation,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ThemeToggle from '~/components/ThemeToggle';
import { cn } from '~/lib/cn';
import { type BaiduApi, type BaiduMap, loadBaiduMap } from './baidu';
import {
  BUILDINGS,
  type Building,
  type BuildingCategory,
  CAMPUS_CONFIG,
  CATEGORY_CONFIG,
  type Campus,
  type CampusId,
} from './data';
import './map.css';

type MapRuntime = {
  api: BaiduApi;
  map: BaiduMap;
};

type MapStatus = 'idle' | 'loading' | 'ready' | 'error';
type CategoryFilter = BuildingCategory | 'all';
type Coord = Building['coord'] | Campus['coord'];

const campusEntries = Object.entries(CAMPUS_CONFIG) as Array<
  [CampusId, Campus]
>;
const campusesWithPlaces = campusEntries.filter(([campusId]) =>
  BUILDINGS.some((building) => building.campus === campusId),
);
const categoryEntries = Object.entries(CATEGORY_CONFIG) as Array<
  [BuildingCategory, (typeof CATEGORY_CONFIG)[BuildingCategory]]
>;

const iconForCategory = (category: BuildingCategory): LucideIcon =>
  category === 'college' ? Building2 : MapPin;

const parseCoord = (coord: Coord): { lng: number; lat: number } => {
  return { lng: coord[0], lat: coord[1] };
};

const markerSvg = (color: string, selected: boolean): string => {
  const size = selected ? 44 : 36;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
    <path d="M22 2.5c-8 0-14.5 6.4-14.5 14.3C7.5 27.4 22 41.5 22 41.5s14.5-14.1 14.5-24.7C36.5 8.9 30 2.5 22 2.5Z" fill="${color}" stroke="white" stroke-width="${selected ? 3 : 2}"/>
    <circle cx="22" cy="17" r="5.4" fill="white"/>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const [status, setStatus] = useState<MapStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    const ak = import.meta.env.VITE_BAIDU_MAP_AK?.trim();
    if (!container) return;
    if (!ak) {
      setStatus('error');
      setErrorMessage('尚未配置百度地图 AK');
      return;
    }

    let active = true;
    setStatus('loading');
    void loadBaiduMap(ak)
      .then((api) => {
        if (!active) return;
        const initialCampus = CAMPUS_CONFIG.huxi;
        const center = parseCoord(initialCampus.coord);
        const map = new api.Map(container, { enableMapClick: false });
        map.centerAndZoom(
          new api.Point(center.lng, center.lat),
          initialCampus.zoom,
        );
        map.enableScrollWheelZoom(true);
        setRuntime({ api, map });
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setStatus('error');
        setErrorMessage(
          error instanceof Error ? error.message : '百度地图加载失败',
        );
      });

    return () => {
      active = false;
      container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (!runtime) return;
    const center = parseCoord(campus.coord);
    runtime.map.centerAndZoom(
      new runtime.api.Point(center.lng, center.lat),
      campus.zoom,
    );
  }, [campus, runtime]);

  useEffect(() => {
    if (!runtime) return;
    runtime.map.clearOverlays();

    buildings.forEach((building) => {
      const coord = parseCoord(building.coord);
      const point = new runtime.api.Point(coord.lng, coord.lat);
      const isSelected = building.id === selected?.id;
      const size = isSelected ? 44 : 36;
      const iconSize = new runtime.api.Size(size, size);
      const icon = new runtime.api.Icon(
        markerSvg(CATEGORY_CONFIG[building.category].color, isSelected),
        iconSize,
        {
          anchor: new runtime.api.Size(size / 2, size),
          imageSize: iconSize,
        },
      );
      const marker = new runtime.api.Marker(point, {
        icon,
        title: building.name,
      });
      marker.addEventListener('click', () => onSelect(building));
      runtime.map.addOverlay(marker);
    });
  }, [buildings, onSelect, runtime, selected?.id]);

  useEffect(() => {
    if (!(runtime && selected)) return;
    const coord = parseCoord(selected.coord);
    runtime.map.panTo(new runtime.api.Point(coord.lng, coord.lat));
  }, [runtime, selected]);

  const zoom = (delta: number) => {
    if (!runtime) return;
    runtime.map.setZoom(runtime.map.getZoom() + delta);
  };

  return (
    <div className="campus-map__canvas relative h-full min-w-0 overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="校园地图"
      />

      {status !== 'ready' ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="max-w-sm border border-line bg-panel/95 px-6 py-5 text-center shadow-xl backdrop-blur">
            <Compass
              size={28}
              className={cn(
                'mx-auto mb-3 text-primary',
                status === 'loading' && 'animate-spin',
              )}
              aria-hidden
            />
            <p className="m-0 font-display text-lg font-semibold text-ink">
              {status === 'error' ? '地图暂时不可用' : '正在展开校园坐标'}
            </p>
            <p className="mt-1.5 mb-0 text-sm text-muted">
              {status === 'error'
                ? `${errorMessage}。请设置 VITE_BAIDU_MAP_AK 后重试。`
                : '仅在打开本页时加载百度地图资源。'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden border border-line bg-panel/92 shadow-lg backdrop-blur md:right-5 md:top-5">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center text-ink hover:bg-mist"
          aria-label="放大地图"
          onClick={() => zoom(1)}
        >
          <Plus size={17} />
        </button>
        <div className="h-px bg-line" />
        <button
          type="button"
          className="grid h-10 w-10 place-items-center text-ink hover:bg-mist"
          aria-label="缩小地图"
          onClick={() => zoom(-1)}
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
  <div className="campus-map__list min-h-0 flex-1 overflow-y-auto">
    {buildings.length ? (
      buildings.map((building, index) => {
        const active = selected?.id === building.id;
        const Icon = iconForCategory(building.category);
        return (
          <button
            type="button"
            key={building.id}
            className={cn(
              'group relative flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors',
              active ? 'bg-primary-faint' : 'bg-panel hover:bg-mist',
            )}
            onClick={() => onSelect(building)}
          >
            <span className="mt-0.5 w-5 shrink-0 font-mono text-[0.65rem] text-muted">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
              style={
                {
                  color: CATEGORY_CONFIG[building.category].color,
                  background: `color-mix(in srgb, ${CATEGORY_CONFIG[building.category].color} 11%, transparent)`,
                } as CSSProperties
              }
            >
              <Icon size={14} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug text-ink">
                {building.name}
              </span>
              <span className="mt-0.5 line-clamp-1 block text-xs text-muted">
                {building.desc}
              </span>
            </span>
            <span
              className={cn(
                'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary transition-opacity',
                active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
              )}
              aria-hidden
            />
          </button>
        );
      })
    ) : (
      <div className="px-6 py-10 text-center">
        <ListFilter size={22} className="mx-auto text-icon" aria-hidden />
        <p className="mt-3 mb-0 font-medium text-ink">没有匹配的地点</p>
        <p className="mt-1 mb-0 text-xs text-muted">换个关键词或分类试试</p>
      </div>
    )}
  </div>
);

const MapPage = () => {
  const [campusId, setCampusId] = useState<CampusId>('huxi');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Building | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  const campus = CAMPUS_CONFIG[campusId];
  const campusBuildings = useMemo(
    () => BUILDINGS.filter((building) => building.campus === campusId),
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

  useEffect(() => {
    document.title = '校园地图 · CQU-openlib';
    return () => {
      document.title = 'CQU-openlib';
    };
  }, []);

  useEffect(() => {
    if (
      selected &&
      !filteredBuildings.some((building) => building.id === selected.id)
    ) {
      setSelected(null);
    }
  }, [filteredBuildings, selected]);

  const chooseCampus = (next: CampusId) => {
    setCampusId(next);
    setSelected(null);
    setCategory('all');
    setMobilePanelOpen(false);
  };

  const chooseBuilding = useCallback((building: Building) => {
    setSelected(building);
    setMobilePanelOpen(false);
  }, []);

  const selectedCoord = selected ? parseCoord(selected.coord) : null;
  const navigationUrl = selectedCoord
    ? `https://api.map.baidu.com/marker?location=${selectedCoord.lat},${selectedCoord.lng}&title=${encodeURIComponent(selected?.name ?? '')}&output=html&src=CQU-openlib`
    : '';

  return (
    <div className="campus-map font-sans text-ink">
      <header className="relative z-30 flex h-[var(--map-header)] items-center border-b border-line bg-panel px-2.5 md:px-4">
        <Link
          to="/"
          className="group flex min-w-0 items-center gap-2 text-ink no-underline"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-white transition-transform group-hover:-translate-x-0.5">
            <ArrowLeft size={16} aria-hidden />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[0.68rem] font-medium tracking-[0.13em] text-muted">
              CQU-OPENLIB
            </span>
            <span className="block font-display text-[0.95rem] font-semibold">
              校园坐标
            </span>
          </span>
        </Link>

        <div className="ml-3 flex min-w-0 flex-1 items-center justify-center gap-1 md:ml-8 md:justify-start">
          {campusesWithPlaces.map(([key, item]) => (
            <button
              type="button"
              key={key}
              className={cn(
                'relative h-8 px-2.5 text-xs transition-colors sm:px-3',
                campusId === key
                  ? 'font-semibold text-primary'
                  : 'text-muted hover:text-ink',
              )}
              onClick={() => chooseCampus(key)}
            >
              {item.name}
              {campusId === key ? (
                <span className="absolute inset-x-2 -bottom-[0.76rem] h-0.5 bg-primary" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden font-mono text-[0.65rem] tracking-wide text-muted lg:block">
            BD-09 · 106°E / 29°N
          </span>
          <ThemeToggle />
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded text-icon hover:bg-mist hover:text-ink md:hidden"
            aria-label={mobilePanelOpen ? '关闭地点列表' : '打开地点列表'}
            onClick={() => setMobilePanelOpen((open) => !open)}
          >
            {mobilePanelOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>

      <div className="campus-map__body relative flex">
        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-20 flex w-[min(22rem,88vw)] flex-col border-r border-line bg-panel shadow-2xl transition-transform md:static md:z-auto md:w-[21rem] md:translate-x-0 md:shadow-none',
            mobilePanelOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          aria-label="校园地点"
        >
          <div className="relative border-b border-line px-4 pt-4 pb-3">
            <div
              className="campus-map__coordinate-spine absolute top-0 bottom-0 left-0 w-1 opacity-50"
              aria-hidden
            />
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="m-0 font-mono text-[0.65rem] tracking-[0.16em] text-primary">
                  {campusId.toUpperCase()} / WAYFINDING
                </p>
                <h1 className="mt-1 mb-0 font-display text-[1.45rem] font-semibold leading-tight">
                  去哪里？
                </h1>
              </div>
              <p className="m-0 font-mono text-[0.68rem] text-muted">
                {campusBuildings.length} PLACES
              </p>
            </div>

            <label className="mt-3 flex h-10 items-center gap-2 border border-line bg-paper px-3 focus-within:border-primary">
              <Search size={15} className="shrink-0 text-icon" aria-hidden />
              <span className="sr-only">搜索地点</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="建筑、食堂、快递点"
                className="min-w-0 flex-1 text-sm placeholder:text-muted"
              />
              {query ? (
                <button
                  type="button"
                  className="grid h-6 w-6 place-items-center text-muted hover:text-ink"
                  aria-label="清空搜索"
                  onClick={() => setQuery('')}
                >
                  <X size={13} />
                </button>
              ) : null}
            </label>
          </div>

          <div className="campus-map__list flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2">
            <button
              type="button"
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors',
                category === 'all'
                  ? 'bg-primary text-white'
                  : 'bg-mist text-muted hover:text-ink',
              )}
              onClick={() => setCategory('all')}
            >
              全部
            </button>
            {categoryEntries.map(([key, item]) => (
              <button
                type="button"
                key={key}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors',
                  category === key
                    ? 'bg-primary text-white'
                    : 'bg-mist text-muted hover:text-ink',
                )}
                onClick={() => setCategory(key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-b border-line px-4 py-2 text-[0.68rem]">
            <span className="font-mono tracking-wide text-muted">地点索引</span>
            <span className="text-muted">
              {filteredBuildings.length} 个结果
            </span>
          </div>

          <BuildingList
            buildings={filteredBuildings}
            selected={selected}
            onSelect={chooseBuilding}
          />
        </aside>

        {mobilePanelOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-10 bg-backdrop md:hidden"
            aria-label="关闭地点列表"
            onClick={() => setMobilePanelOpen(false)}
          />
        ) : null}

        <main className="relative min-w-0 flex-1">
          <MapSurface
            buildings={filteredBuildings}
            campus={campus}
            selected={selected}
            onSelect={chooseBuilding}
          />

          {!mobilePanelOpen ? (
            <button
              type="button"
              className="absolute top-3 left-3 z-10 inline-flex h-10 items-center gap-2 border border-line bg-panel/92 px-3 text-sm font-medium shadow-lg backdrop-blur md:hidden"
              onClick={() => setMobilePanelOpen(true)}
            >
              <ListFilter size={15} aria-hidden />
              {filteredBuildings.length} 个地点
            </button>
          ) : null}

          {selected && selectedCoord ? (
            <section className="absolute right-3 bottom-3 left-3 z-10 border border-line bg-panel/95 p-3 shadow-2xl backdrop-blur md:right-auto md:bottom-5 md:left-5 md:w-[22rem] md:p-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
                  style={{
                    background: CATEGORY_CONFIG[selected.category].color,
                  }}
                >
                  <MapPin size={17} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 font-mono text-[0.62rem] tracking-[0.12em] text-muted">
                    {selectedCoord.lng.toFixed(6)} E ·{' '}
                    {selectedCoord.lat.toFixed(6)} N
                  </p>
                  <h2 className="mt-1 mb-0 font-display text-lg font-semibold leading-tight">
                    {selected.name}
                  </h2>
                  <p className="mt-1 mb-0 line-clamp-2 text-xs leading-relaxed text-muted">
                    {selected.desc}
                  </p>
                </div>
                <button
                  type="button"
                  className="grid h-7 w-7 shrink-0 place-items-center text-muted hover:text-ink"
                  aria-label="关闭地点详情"
                  onClick={() => setSelected(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <a
                href={navigationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex h-9 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white no-underline hover:bg-primary-hover"
              >
                <Navigation size={15} aria-hidden />
                使用百度地图导航
              </a>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default MapPage;
