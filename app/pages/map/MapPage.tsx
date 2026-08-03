import {
  Compass,
  ListFilter,
  MapPin,
  Menu,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocsShell from '~/components/DocsShell';
import { cn } from '~/lib/cn';
import { type BaiduApi, type BaiduMap, loadBaiduMap } from './baidu';
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
import { navigationLinksFor } from './navigation';

type MapRuntime = {
  api: BaiduApi;
  map: BaiduMap;
};

type MapStatus = 'idle' | 'loading' | 'ready' | 'error';
type CategoryFilter = BuildingCategory | 'all';
type Coord = Building['coord'] | Campus['center'];

const campusesWithPlaces = CAMPUSES.filter((campus) =>
  BUILDINGS.some((building) => building.campusId === campus.id),
);

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
        const initialCampus = CAMPUS_BY_ID['science-city-huxi'];
        const center = parseCoord(initialCampus.center);
        const map = new api.Map(container, { enableMapClick: false });
        map.centerAndZoom(
          new api.Point(center.lng, center.lat),
          initialCampus.defaultZoom,
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
    const center = parseCoord(campus.center);
    runtime.map.centerAndZoom(
      new runtime.api.Point(center.lng, center.lat),
      campus.defaultZoom,
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
        markerSvg(BUILDING_CATEGORY_BY_ID[building.category].color, isSelected),
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
    <div className="relative h-full min-w-0 overflow-hidden bg-primary-faint [&_.BMap_cpyCtrl]:z-5! [&_.anchorBL]:z-5!">
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
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{
                background: BUILDING_CATEGORY_BY_ID[building.category].color,
              }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug text-ink">
                {building.name}
              </span>
              <span className="mt-0.5 line-clamp-1 block text-xs text-muted">
                {building.desc}
              </span>
            </span>
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
  const [campusId, setCampusId] = useState<CampusId>('science-city-huxi');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Building | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

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

  const navigationLinks = selected ? navigationLinksFor(selected) : [];

  return (
    <DocsShell fullBleed>
      <section className="h-[calc(100dvh-var(--layout-header))] min-h-[30rem] overflow-hidden bg-panel font-sans text-ink max-md:min-h-[28rem]">
        <header className="relative z-30 flex h-[3.5rem] items-center gap-3 border-b border-line bg-panel px-3 max-md:h-[3.25rem] md:px-4">
          <h1 className="m-0 shrink-0 font-display text-lg font-semibold leading-tight">
            校园地图
          </h1>

          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {campusesWithPlaces.map((item) => (
              <button
                type="button"
                key={item.id}
                className={cn(
                  'h-8 shrink-0 rounded px-2.5 text-xs transition-colors sm:px-3',
                  campusId === item.id
                    ? 'bg-primary-soft font-semibold text-primary'
                    : 'text-muted hover:text-ink',
                )}
                onClick={() => chooseCampus(item.id)}
              >
                {item.campusName}
                {item.siteName}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-1">
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

        <div className="relative flex h-[calc(100%-3.5rem)] min-h-[calc(30rem-3.5rem)] max-md:h-[calc(100%-3.25rem)] max-md:min-h-[calc(28rem-3.25rem)]">
          <aside
            className={cn(
              'absolute inset-y-0 left-0 z-20 flex w-[min(22rem,88vw)] flex-col border-r border-line bg-panel shadow-2xl transition-transform md:static md:z-auto md:w-[21rem] md:translate-x-0 md:shadow-none',
              mobilePanelOpen ? 'translate-x-0' : '-translate-x-full',
            )}
            aria-label="校园地点"
          >
            <div className="flex gap-2 border-b border-line p-3">
              <label className="flex h-10 min-w-0 flex-1 items-center gap-2 border border-line bg-paper px-3 focus-within:border-primary">
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
              <select
                value={category}
                aria-label="地点分类"
                className="h-10 w-24 shrink-0 appearance-auto border border-line bg-paper px-2 text-xs text-ink focus:border-primary"
                onChange={(event) =>
                  setCategory(event.target.value as CategoryFilter)
                }
              >
                <option value="all">全部分类</option>
                {BUILDING_CATEGORIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
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

          <div className="relative min-w-0 flex-1">
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

            {selected ? (
              <section className="absolute right-3 bottom-3 left-3 z-10 border border-line bg-panel/95 p-3 shadow-2xl backdrop-blur md:right-auto md:bottom-5 md:left-5 md:w-[28rem] md:p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
                    style={{
                      background:
                        BUILDING_CATEGORY_BY_ID[selected.category].color,
                    }}
                  >
                    <MapPin size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 font-display text-lg font-semibold leading-tight">
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
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {navigationLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 items-center justify-center border border-line bg-paper px-1 text-xs font-medium text-ink no-underline hover:border-primary hover:text-primary"
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
    </DocsShell>
  );
};

export default MapPage;
