export type CourseCodeSearchEntry = {
  title: string;
  path: string;
  section: string;
  codes: string[];
};

export type CourseCodeSearchChunk = Record<string, CourseCodeSearchEntry[]>;

const courseCodePattern = /^[a-z0-9][a-z0-9_-]*$/i;
const bucketCount = 64;

export const normalizeCourseCode = (value: string): string =>
  value.trim().toLowerCase();

export const isCourseCodeQuery = (value: string): boolean =>
  courseCodePattern.test(normalizeCourseCode(value));

export const courseCodeBucket = (value: string): string => {
  let hash = 2166136261;
  for (const char of normalizeCourseCode(value)) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  }
  return ((hash >>> 0) % bucketCount).toString(16).padStart(2, '0');
};
