import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { HoxRoot } from 'hox';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { trackPageEnter } from '~/lib/analytics';
import { cleanPath, decodePathname } from '~/lib/paths';
import { purgeLegacyStorage } from '~/lib/purgeLegacyStorage';
import { createAppQueryClient } from '~/lib/queryClient';
import { routeTree } from './routeTree.gen';

purgeLegacyStorage();

const router = createRouter({ routeTree });
const queryClient = createAppQueryClient();

/** Decoded so reports read as `/course/高等数学`, not as percent escapes. */
const trackLocation = (pathname: string) =>
  trackPageEnter(cleanPath(decodePathname(pathname)));

router.subscribe('onResolved', ({ toLocation }) => {
  trackLocation(toLocation.pathname);
});
trackLocation(window.location.pathname);

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HoxRoot>
        <RouterProvider router={router} />
      </HoxRoot>
    </QueryClientProvider>
  </StrictMode>,
);
