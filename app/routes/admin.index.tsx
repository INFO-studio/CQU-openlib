import { createFileRoute, redirect } from '@tanstack/react-router';

/** Keep `/admin/` working; content lives on `/admin`. */
export const Route = createFileRoute('/admin/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin' });
  },
});
