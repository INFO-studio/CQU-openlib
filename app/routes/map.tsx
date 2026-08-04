import { createFileRoute } from '@tanstack/react-router';
import { CAMPUS_BY_ID, type CampusId } from '~/pages/map/data';
import MapPage from '~/pages/map/MapPage';

type MapSearch = {
  campus?: CampusId;
  focus?: string;
};

export const Route = createFileRoute('/map')({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    campus:
      typeof search.campus === 'string' &&
      Object.hasOwn(CAMPUS_BY_ID, search.campus)
        ? (search.campus as CampusId)
        : undefined,
    focus: typeof search.focus === 'string' ? search.focus : undefined,
  }),
  component: MapPage,
});
