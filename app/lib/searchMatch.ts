import type { CourseCodeSearchEntry } from '~/lib/courseCodeSearch';
import { cleanPath, decodePathname } from '~/lib/paths';

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

export type InitialSearchResults = {
  hits: SearchHit[];
  loadedHitCount: number;
  results: SearchResult[];
};

const asciiTokenPattern = /^[a-z0-9_-]+$/i;
const hanPattern = /\p{Script=Han}/gu;

const documentPath = (path: string): string =>
  cleanPath(decodePathname(path.split(/[?#]/, 1)[0] ?? path));

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

export const exactCourseCodeResults = (
  entries: CourseCodeSearchEntry[],
): SearchResult[] =>
  entries.map((entry) => ({
    id: `code:${entry.path}`,
    path: entry.path,
    title: entry.title,
    section: entry.section,
    codes: entry.codes.join(' '),
    excerpt: '',
    exact: true,
  }));

export const mergeSearchResults = (
  priority: SearchResult[],
  rest: SearchResult[],
): SearchResult[] => {
  const seen = new Set<string>();
  return [...priority, ...rest].filter(({ path }) => {
    const key = documentPath(path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const loadInitialSearchResults = async (
  engine: SearchEngine,
  query: string,
  exactEntries: CourseCodeSearchEntry[],
  pageSize: number,
): Promise<InitialSearchResults> => {
  const hits = await searchDocuments(engine, query);
  const loadedHitCount = Math.min(pageSize, hits.length);
  const fulltext = await loadSearchResults(hits.slice(0, loadedHitCount));
  return {
    hits,
    loadedHitCount,
    results: mergeSearchResults(exactCourseCodeResults(exactEntries), fulltext),
  };
};
