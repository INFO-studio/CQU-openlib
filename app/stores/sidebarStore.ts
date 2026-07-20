import { createGlobalStore } from 'hox';
import { useCallback, useState } from 'react';

/** Expanded folder paths in the docs sidebar tree. Default: all collapsed. */
export const [useSidebarStore, getSidebarStore] = createGlobalStore(() => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const isExpanded = useCallback(
    (path: string) => expanded.has(path),
    [expanded],
  );

  const setOpen = useCallback((path: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  /** Ensure ancestors of the current page are expanded (still default-collapsed otherwise). */
  const ensureAncestorsOpen = useCallback((currentPath: string) => {
    const parts = currentPath.replace(/^\//, '').split('/').filter(Boolean);
    if (parts.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let acc = '';
      for (let i = 0; i < parts.length - 1; i++) {
        acc += `/${parts[i]}`;
        next.add(acc);
      }
      return next;
    });
  }, []);

  return { expanded, isExpanded, setOpen, toggle, ensureAncestorsOpen };
});
