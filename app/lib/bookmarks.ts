const STORAGE_KEY = 'cqu-openlib-bookmarks';
export type Bookmark = {
  title: string;
  path: string;
  savedAt: number;
};
export const readBookmarks = (): Bookmark[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
export const writeBookmarks = (items: Bookmark[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};
export const toggleBookmark = (item: Bookmark): Bookmark[] => {
  const current = readBookmarks();
  const exists = current.some((b) => b.path === item.path);
  const next = exists
    ? current.filter((b) => b.path !== item.path)
    : [{ ...item, savedAt: Date.now() }, ...current];
  writeBookmarks(next);
  return next;
};
export const isBookmarked = (path: string): boolean => {
  return readBookmarks().some((b) => b.path === path);
};
export const clearBookmarks = () => {
  writeBookmarks([]);
};
