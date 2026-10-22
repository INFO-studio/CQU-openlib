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

  // Includes the page itself, so landing on a folder index shows its children.
  const ensurePathOpen = useCallback((currentPath: string) => {
    const parts = currentPath.replace(/^\//, '').split('/').filter(Boolean);
    if (parts.length === 0) return;
    const prefixes = parts.map(
      (_, index) => `/${parts.slice(0, index + 1).join('/')}`,
    );
    setExpanded((prev) => new Set([...prev, ...prefixes]));
  }, []);

  return { expanded, isExpanded, setOpen, toggle, ensurePathOpen };
});
