import { describe, expect, it } from 'vite-plus/test';
import { resolveStoredPreferences } from '~/stores/preferencesStore';

describe('resolveStoredPreferences', () => {
  it('reads theme and map campus from the consolidated value', () => {
    expect(
      resolveStoredPreferences(
        JSON.stringify({ theme: 'dark', mapCampusId: 'a' }),
        'light',
        'light',
      ),
    ).toEqual({ theme: 'dark', mapCampusId: 'a' });
  });

  it('falls back to the legacy theme when the new value is corrupted', () => {
    expect(resolveStoredPreferences('{broken', 'dark', 'light')).toEqual({
      theme: 'dark',
      mapCampusId: null,
    });
    expect(resolveStoredPreferences('null', 'dark', 'light')).toEqual({
      theme: 'dark',
      mapCampusId: null,
    });
  });

  it('uses the system preference after invalid stored themes', () => {
    expect(
      resolveStoredPreferences(
        JSON.stringify({ theme: 'sepia', mapCampusId: 1 }),
        'sepia',
        'dark',
      ),
    ).toEqual({ theme: 'dark', mapCampusId: null });
  });
});
