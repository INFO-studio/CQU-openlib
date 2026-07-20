import { createGlobalStore } from 'hox';
import { useCallback, useState } from 'react';

export const [useUiStore, getUiStore] = createGlobalStore(() => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return {
    searchOpen,
    setSearchOpen,
    openSearch,
    closeSearch,
    sidebarOpen,
    setSidebarOpen,
    openSidebar,
    closeSidebar,
  };
});
