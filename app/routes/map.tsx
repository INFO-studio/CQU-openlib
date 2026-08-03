import { createFileRoute } from '@tanstack/react-router';
import MapPage from '~/pages/map/MapPage';

export const Route = createFileRoute('/map')({
  component: MapPage,
});
