import { createGlobalStore } from 'hox';
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
type Preferences = { theme: Theme; mapCampusId: string | null };
const STORAGE_KEY = 'cqu-openlib-preferences';
const LEGACY_THEME_KEY = 'cqu-openlib-theme';

const preferredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const parseStoredPreferences = (
  stored: string | null,
): Partial<Preferences> => {
  if (!stored) return {};
  try {
    const value: unknown = JSON.parse(stored);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<Preferences>)
      : {};
  } catch {
    return {};
  }
};

export const resolveStoredPreferences = (
  stored: string | null,
  legacyTheme: string | null,
  fallbackTheme: Theme,
): Preferences => {
  const parsed = parseStoredPreferences(stored);
  const theme =
    parsed.theme === 'light' || parsed.theme === 'dark'
      ? parsed.theme
      : legacyTheme === 'light' || legacyTheme === 'dark'
        ? legacyTheme
        : fallbackTheme;
  return {
    theme,
    mapCampusId:
      typeof parsed.mapCampusId === 'string' ? parsed.mapCampusId : null,
  };
};

const initialPreferences = (): Preferences => {
  const fallback: Preferences = { theme: preferredTheme(), mapCampusId: null };
  if (typeof window === 'undefined') return fallback;
  try {
    return resolveStoredPreferences(
      window.localStorage.getItem(STORAGE_KEY),
      window.localStorage.getItem(LEGACY_THEME_KEY),
      fallback.theme,
    );
  } catch {
    return fallback;
  }
};

export const [usePreferencesStore, getPreferencesStore] = createGlobalStore(
  () => {
    const [preferences, setPreferences] =
      useState<Preferences>(initialPreferences);
    useEffect(() => {
      document.documentElement.dataset.theme = preferences.theme;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        window.localStorage.removeItem(LEGACY_THEME_KEY);
      } catch {
        // Runtime state still works when browser storage is unavailable.
      }
    }, [preferences]);
    const setTheme = useCallback(
      (theme: Theme) =>
        setPreferences((current) =>
          current.theme === theme ? current : { ...current, theme },
        ),
      [],
    );
    const toggleTheme = useCallback(
      () =>
        setPreferences((current) => ({
          ...current,
          theme: current.theme === 'light' ? 'dark' : 'light',
        })),
      [],
    );
    const setMapCampusId = useCallback(
      (mapCampusId: string) =>
        setPreferences((current) =>
          current.mapCampusId === mapCampusId
            ? current
            : { ...current, mapCampusId },
        ),
      [],
    );
    return { ...preferences, setTheme, toggleTheme, setMapCampusId };
  },
);
