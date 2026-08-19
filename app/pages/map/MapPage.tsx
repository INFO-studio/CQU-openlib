import { Dialog } from '@base-ui/react/dialog';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ListFilter } from 'lucide-react';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import DocsShell from '~/components/DocsShell';
import { useDesktopLayout } from '~/hooks/useDesktopLayout';
import { useTitle } from '~/hooks/useTitle';
import { usePreferencesStore } from '~/stores/preferencesStore';
import MapItemDetails from './components/MapItemDetails';
import MapPageHeader from './components/MapPageHeader';
import MapSidebarContent from './components/MapSidebarContent';
import MapSurface from './components/MapSurface';
import { CAMPUS_BY_ID } from './data';
import { useCampusItems } from './hooks/useCampusItems';
import type { CampusId, CategoryFilter, MapItem } from './type';
import { campusIdFromMapItemId, isCampusId } from './utils/campus';
import { filterMapItems } from './utils/filterMapItems';
import { buildMapSearch } from './utils/mapSearch';

const DEFAULT_CAMPUS_ID: CampusId = 'd';

const MapPage = () => {
  const {
    campus: campusSearch,
    filter,
    focus: focusId,
  } = useSearch({ from: '/map' });
  const navigate = useNavigate({ from: '/map' });
  const isDesktop = useDesktopLayout();
  const { mapCampusId, setMapCampusId } = usePreferencesStore();
  const [query, setQuery] = useState('');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const category: CategoryFilter = filter ?? 'all';

  const focusCampusId = campusIdFromMapItemId(focusId);
  const campusId =
    focusCampusId ??
    campusSearch ??
    (isCampusId(mapCampusId) ? mapCampusId : DEFAULT_CAMPUS_ID);
  const campus = CAMPUS_BY_ID[campusId];
  const { items: campusItems, status: campusDataStatus } =
    useCampusItems(campusId);
  const selected = useMemo<MapItem | null>(
    () => campusItems.find((item) => item.id === focusId) ?? null,
    [campusItems, focusId],
  );
  const filteredItems = useMemo(
    () => filterMapItems(campusItems, category, query),
    [campusItems, category, query],
  );
  const markerItems = useDeferredValue(filteredItems);
  const visibleMarkerItems = useMemo(() => {
    if (!selected || markerItems.some((item) => item.id === selected.id)) {
      return markerItems;
    }
    return [...markerItems, selected];
  }, [markerItems, selected]);

  useTitle('校园地图');

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
    void navigate({ search: buildMapSearch({ campus: next }) });
    setMobilePanelOpen(false);
  };

  const chooseItem = useCallback(
    (item: MapItem) => {
      void navigate({
        search: (previous) =>
          buildMapSearch({
            campus: item.campusId,
            filter: previous.filter,
            focus: previous.focus === item.id ? undefined : item.id,
          }),
      });
      setMobilePanelOpen(false);
    },
    [navigate],
  );

  const clearSelection = () => {
    void navigate({ search: buildMapSearch({ campus: campusId, filter }) });
  };

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    if (focusId) {
      void navigate({ search: buildMapSearch({ campus: campusId, filter }) });
    }
  };

  const changeCategory = (nextCategory: CategoryFilter) => {
    void navigate({
      search: buildMapSearch({ campus: campusId, filter: nextCategory }),
    });
  };

  return (
    <DocsShell fullBleed>
      <Dialog.Root
        open={!isDesktop && mobilePanelOpen}
        onOpenChange={setMobilePanelOpen}
      >
        <section className="h-[calc(100dvh-var(--layout-header))] min-h-[30rem] overflow-hidden bg-panel font-sans text-ink max-md:min-h-[28rem]">
          <MapPageHeader campusId={campusId} onCampusChange={chooseCampus} />
          <div className="relative flex h-[calc(100%-3.5rem)] min-h-[calc(30rem-3.5rem)] max-md:h-[calc(100%-3.25rem)] max-md:min-h-[calc(28rem-3.25rem)]">
            {isDesktop ? (
              <aside
                className="flex w-[21rem] shrink-0 flex-col border-r border-line bg-panel"
                aria-label="校园地点"
              >
                <MapSidebarContent
                  items={filteredItems}
                  selected={selected}
                  status={campusDataStatus}
                  query={query}
                  category={category}
                  mobile={false}
                  onQueryChange={changeQuery}
                  onCategoryChange={changeCategory}
                  onSelect={chooseItem}
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
                    items={filteredItems}
                    selected={selected}
                    status={campusDataStatus}
                    query={query}
                    category={category}
                    mobile
                    onQueryChange={changeQuery}
                    onCategoryChange={changeCategory}
                    onSelect={chooseItem}
                  />
                </Dialog.Popup>
              </Dialog.Portal>
            )}

            <div className="relative min-w-0 flex-1">
              <MapSurface
                items={visibleMarkerItems}
                campus={campus}
                selected={selected}
                onSelect={chooseItem}
              />
              {!mobilePanelOpen ? (
                <Dialog.Trigger className="absolute top-3 left-3 z-10 inline-flex h-10 items-center gap-2 rounded-md border border-line bg-panel/92 px-3 text-sm font-medium text-icon-strong shadow-lg backdrop-blur md:hidden">
                  <ListFilter size={15} aria-hidden />
                  {filteredItems.length} 个地点
                </Dialog.Trigger>
              ) : null}
              {selected ? (
                <MapItemDetails item={selected} onClose={clearSelection} />
              ) : null}
            </div>
          </div>
        </section>
      </Dialog.Root>
    </DocsShell>
  );
};

export default MapPage;
