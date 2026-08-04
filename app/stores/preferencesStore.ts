import { createGlobalStore } from 'hox';
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

type Preferences = {
  theme: Theme;
  mapCampusId: string | null;
};

const STORAGE_KEY = 'cqu-openlib-preferences';
const LEGACY_THEME_KEY = 'cqu-openlib-theme';

const preferredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

export const resolveStoredPreferences = (
  stored: string | null,
  legacyTheme: string | null,
  fallbackTheme: Theme,
): Preferences => {
  let parsed: Partial<Preferences> = {};
  if (stored) {
    try {
      const value: unknown = JSON.parse(stored);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed = value as Partial<Preferences>;
      }
    } catch {
      // Fall through to the legacy theme or system preference.
    }
  }

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
  const fallback: Preferences = {
    theme: preferredTheme(),
    mapCampusId: null,
  };
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_KEY);
    return resolveStoredPreferences(stored, legacyTheme, fallback.theme);
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
        // Storage may be unavailable in private browsing; runtime state still works.
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

    return {
      ...preferences,
      setTheme,
      toggleTheme,
      setMapCampusId,
    };
  },
);
