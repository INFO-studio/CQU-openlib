import { queryOptions } from '@tanstack/react-query';
import type { SearchChunkFile, SearchChunkMeta, SearchEntry } from '~/lib/nav';
import { queryKeys } from '~/queries/keys';
export const searchChunkQueryOptions = (meta: SearchChunkMeta) => {
  return queryOptions({
    queryKey: queryKeys.searchChunk(meta.id),
    queryFn: async (): Promise<SearchEntry[]> => {
      const res = await fetch(meta.url);
      if (!res.ok) throw new Error(`search chunk ${meta.id} ${res.status}`);
      const data = (await res.json()) as SearchChunkFile;
      return data.entries;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
};
