import { QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { HoxRoot } from 'hox';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAppQueryClient } from '~/lib/queryClient';
import { routeTree } from './routeTree.gen';

const router = createRouter({ routeTree });
const queryClient = createAppQueryClient();

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
