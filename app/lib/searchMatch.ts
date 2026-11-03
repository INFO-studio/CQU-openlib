import type { CourseCodeSearchEntry } from '~/lib/courseCodeSearch';
import { exactTitleToken } from '~/lib/exactTitle';
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

const pagefindQuery = (normalized: string): string => {
  const hanLength = normalized.match(hanPattern)?.length ?? 0;
  const phrase =
    asciiTokenPattern.test(normalized) ||
    (!normalized.includes(' ') && hanLength >= 5);
  return phrase ? `"${normalized}"` : normalized;
};

const prependExactTitles = (
  exact: SearchHit[],
  rest: SearchHit[],
): SearchHit[] => {
  const restById = new Map(rest.map((hit) => [hit.id, hit]));
  const exactIds = new Set(exact.map((hit) => hit.id));
  return [
    ...exact.flatMap((hit) => [restById.get(hit.id) ?? hit]),
    ...rest.filter((hit) => !exactIds.has(hit.id)),
  ];
};

export const searchDocuments = async (
  engine: SearchEngine,
  query: string,
): Promise<SearchHit[]> => {
  const normalized = query.trim();
  if (!normalized) return [];
  const [exact, rest] = await Promise.all([
    engine.search(exactTitleToken(normalized)),
    engine.search(pagefindQuery(normalized)),
  ]);
  return prependExactTitles(exact.results, rest.results);
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
        title: data.meta.label || data.meta.title,
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
