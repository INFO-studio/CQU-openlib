export const queryKeys = {
  navIndex: ['nav-index'] as const,
  doc: (page: string) => ['doc', page] as const,
  searchChunk: (id: string) => ['search-chunk', id] as const,
};
