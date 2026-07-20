import { QueryClient } from '@tanstack/react-query';

const isAbortError = (e: unknown): boolean => {
  return (
    (e instanceof DOMException || e instanceof Error) && e.name === 'AbortError'
  );
};
export const createAppQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        retry: (failureCount, error) => {
          if (isAbortError(error)) return failureCount < 2;
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
};
export { isAbortError };
