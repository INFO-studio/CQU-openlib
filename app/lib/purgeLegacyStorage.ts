/**
 * The MkDocs-era 课表 page stored 统一认证 credentials in localStorage as bare
 * base64 (`{"username","password"}` via btoa) plus the fetched schedule. Its
 * script and its "重置本页" button are both gone, so anyone who used that page
 * still carries their password on this origin with no way to clear it. Purge on
 * boot. Safe to delete once enough time has passed for returning visitors.
 */
const LEGACY_KEYS = ['userCredentials', 'curriculumEvents'];

export const purgeLegacyStorage = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
  } catch {
    // Private mode or a blocked origin — nothing we can do, and nothing to fix.
  }
};
