import { createGlobalStore } from 'hox';
import { useCallback, useState } from 'react';

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

  const ensureAncestorsOpen = useCallback((currentPath: string) => {
    const parts = currentPath.replace(/^\//, '').split('/').filter(Boolean);
    if (parts.length === 0) return;
    const ancestors = parts
      .slice(0, -1)
      .map((_, index) => `/${parts.slice(0, index + 1).join('/')}`);
    setExpanded((prev) => new Set([...prev, ...ancestors]));
  }, []);

  return { expanded, isExpanded, setOpen, toggle, ensureAncestorsOpen };
});
