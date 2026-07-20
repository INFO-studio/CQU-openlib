import type { SearchEntry } from '~/lib/nav';
export const entryMatches = (entry: SearchEntry, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (entry.title.toLowerCase().includes(q)) return true;
  if (entry.path.toLowerCase().includes(q)) return true;
  if (entry.sectionLabel.toLowerCase().includes(q)) return true;
  return entry.codes?.some((code) => code.toLowerCase().includes(q)) ?? false;
};
export const matchScore = (entry: SearchEntry, query: string): number => {
  const q = query.trim().toLowerCase();
  if (!q || !entry.codes?.length) return 3;
  if (entry.codes.some((c) => c.toLowerCase() === q)) return 0;
  if (entry.codes.some((c) => c.toLowerCase().startsWith(q))) return 1;
  if (entry.codes.some((c) => c.toLowerCase().includes(q))) return 2;
  return 3;
};
export const sortMatches = (
  entries: SearchEntry[],
  query: string,
): SearchEntry[] => {
  const q = query.trim();
  if (!q) return entries;
  return [...entries].sort((a, b) => matchScore(a, q) - matchScore(b, q));
};
