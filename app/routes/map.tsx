import { createFileRoute } from '@tanstack/react-router';
import MapPage from '~/pages/map/MapPage';

type MapSearch = {
  focus?: string;
};

export const Route = createFileRoute('/map')({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    focus: typeof search.focus === 'string' ? search.focus : undefined,
  }),
  component: MapPage,
});
