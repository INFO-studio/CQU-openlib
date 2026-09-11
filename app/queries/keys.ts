export const queryKeys = {
  navIndex: ['nav-index'] as const,
  doc: (page: string) => ['doc', page] as const,
  searchChunk: (id: string) => ['search-chunk', id] as const,
  graduationManifest: () => ['graduation', 'manifest'] as const,
  graduationOverview: () => ['graduation', 'overview'] as const,
  graduationDetail: (scope: string, facet: string) =>
    ['graduation', 'detail', scope, facet] as const,
};
