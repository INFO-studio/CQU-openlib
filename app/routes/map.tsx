import { createFileRoute } from '@tanstack/react-router';
import MapPage from '~/pages/map/MapPage';
import type { MapSearch } from '~/pages/map/type';
import { validateMapSearch } from '~/pages/map/utils/mapSearch';

export const Route = createFileRoute('/map')({
  validateSearch: (search: Record<string, unknown>): MapSearch =>
    validateMapSearch(search),
  component: MapPage,
});
