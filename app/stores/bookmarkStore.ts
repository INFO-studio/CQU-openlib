import { createGlobalStore } from 'hox';
import { useCallback, useEffect, useState } from 'react';
import {
  type Bookmark,
  clearBookmarks as clearStorage,
  readBookmarks,
  toggleBookmark as toggleStorage,
  writeBookmarks,
} from '~/lib/bookmarks';

export const [useBookmarkStore, getBookmarkStore] = createGlobalStore(() => {
  const [items, setItems] = useState<Bookmark[]>(() =>
    typeof window === 'undefined' ? [] : readBookmarks(),
  );

  useEffect(() => {
    setItems(readBookmarks());
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== 'cqu-openlib-bookmarks') return;
      setItems(readBookmarks());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const isBookmarked = useCallback(
    (path: string) => items.some((b) => b.path === path),
    [items],
  );

  const toggle = useCallback((item: Bookmark) => {
    const next = toggleStorage(item);
    setItems(next);
    return next;
  }, []);

  const clear = useCallback(() => {
    clearStorage();
    setItems([]);
  }, []);

  const setAll = useCallback((next: Bookmark[]) => {
    writeBookmarks(next);
    setItems(next);
  }, []);

  return { items, isBookmarked, toggle, clear, setAll };
});
