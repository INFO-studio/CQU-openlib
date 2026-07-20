import { createGlobalStore } from 'hox';
import { useEffect, useState } from 'react';
export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'cqu-openlib-theme';
const getPreferredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};
export const [useThemeStore, getThemeStore] = createGlobalStore(() => {
  const [theme, setThemeState] = useState<Theme>(() => getPreferredTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);
  const setTheme = (next: Theme) => setThemeState(next);
  const toggle = () =>
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  return { theme, setTheme, toggle };
});
