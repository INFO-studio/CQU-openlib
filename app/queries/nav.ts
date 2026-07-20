import { queryOptions, useQuery } from '@tanstack/react-query';
import type { DocNavIndex } from '~/lib/nav';
import { queryKeys } from '~/queries/keys';

const fetchNavIndex = async (): Promise<DocNavIndex> => {
  const res = await fetch('/nav-index.json');
  if (!res.ok) throw new Error(`nav-index ${res.status}`);
  return (await res.json()) as DocNavIndex;
};
export const navIndexQueryOptions = queryOptions({
  queryKey: queryKeys.navIndex,
  queryFn: fetchNavIndex,
  staleTime: Infinity,
  gcTime: Infinity,
});
export const useNavIndex = () => {
  return useQuery(navIndexQueryOptions);
};
