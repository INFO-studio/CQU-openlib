export type SearchFragment = {
  url: string;
  excerpt: string;
  meta: Record<string, string>;
  sub_results: { url: string; title: string; excerpt: string }[];
};
export type SearchHit = {
  id: string;
  data: () => Promise<SearchFragment>;
};
export type SearchResult = {
  id: string;
  path: string;
  title: string;
  section: string;
  codes: string;
  excerpt: string;
  exact: boolean;
};
export type SearchEngine = {
  options: (options: {
    basePath?: string;
    baseUrl?: string;
    excerptLength: number;
  }) => Promise<void>;
  init: () => Promise<void>;
  search: (query: string) => Promise<{ results: SearchHit[] }>;
};

const asciiTokenPattern = /^[a-z0-9_-]+$/i;
const hanPattern = /\p{Script=Han}/gu;

export const searchDocuments = async (
  engine: SearchEngine,
  query: string,
): Promise<SearchHit[]> => {
  const normalized = query.trim();
  if (!normalized) return [];
  const hanLength = normalized.match(hanPattern)?.length ?? 0;
  const exact =
    asciiTokenPattern.test(normalized) ||
    (!normalized.includes(' ') && hanLength >= 5);
  return (await engine.search(exact ? `"${normalized}"` : normalized)).results;
};

export const loadSearchResults = async (
  hits: SearchHit[],
): Promise<SearchResult[]> =>
  Promise.all(
    hits.map(async (hit) => {
      const data = await hit.data();
      const sub = data.sub_results?.find((result) => result.url.includes('#'));
      return {
        id: hit.id,
        path: sub?.url ?? data.url,
        title: data.meta.title,
        section: [data.meta.section, data.meta.heading || sub?.title]
          .filter(Boolean)
          .join(' · '),
        codes: data.meta.codes ?? '',
        excerpt: sub?.excerpt ?? data.excerpt,
        exact: false,
      };
    }),
  );
