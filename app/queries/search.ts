import {
  type CourseCodeSearchChunk,
  type CourseCodeSearchEntry,
  courseCodeBucket,
  isCourseCodeQuery,
  normalizeCourseCode,
} from '~/lib/courseCodeSearch';
import type { SearchEngine } from '~/lib/searchMatch';

let engine: Promise<SearchEngine> | undefined;
const codeChunks = new Map<string, Promise<CourseCodeSearchChunk>>();

export const findExactCourseCodes = async (
  query: string,
): Promise<CourseCodeSearchEntry[]> => {
  if (!isCourseCodeQuery(query)) return [];
  const code = normalizeCourseCode(query);
  const bucket = courseCodeBucket(code);
  let chunk = codeChunks.get(bucket);
  if (!chunk) {
    chunk = fetch(`/search/codes/${bucket}.json`).then(async (response) => {
      if (response.status === 404) return {};
      if (!response.ok) throw new Error(`course code chunk ${response.status}`);
      return (await response.json()) as CourseCodeSearchChunk;
    });
    codeChunks.set(bucket, chunk);
  }
  return (await chunk)[code] ?? [];
};

export const getSearchEngine = (): Promise<SearchEngine> => {
  if (!engine) {
    const url = '/search/pagefind/pagefind.js';
    engine = import(/* @vite-ignore */ url)
      .then(async (module: SearchEngine) => {
        await module.options({ baseUrl: '/', excerptLength: 24 });
        await module.init();
        return module;
      })
      .catch((error) => {
        engine = undefined;
        throw error;
      });
  }
  return engine;
};
