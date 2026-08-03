import { createFileRoute } from '@tanstack/react-router';
import MapPage from '~/pages/map/MapPage';

type MapSearch = {
  focus?: string;
};

const MapRoute = () => {
  const { focus } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <MapPage
      focusId={focus}
      onFocusChange={(nextFocus) => {
        void navigate({
          search: nextFocus ? { focus: nextFocus } : {},
        });
      }}
    />
  );
};

export const Route = createFileRoute('/map')({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    focus: typeof search.focus === 'string' ? search.focus : undefined,
  }),
  component: MapRoute,
});
