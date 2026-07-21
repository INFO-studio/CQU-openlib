import type { FormSlug } from '~/lib/formTypes';

const STORAGE_KEY = 'cqu-openlib:form-drafts';

/** One JSON-serializable draft per form slug. */
export type FormDraftsRecord = Partial<Record<FormSlug, unknown>>;

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const readFormDrafts = (): FormDraftsRecord => {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as FormDraftsRecord;
  } catch {
    return {};
  }
};

export const writeFormDrafts = (drafts: FormDraftsRecord): void => {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Quota / private mode — ignore.
  }
};

export const readFormDraft = <T>(slug: FormSlug): T | null => {
  const entry = readFormDrafts()[slug];
  if (entry == null || typeof entry !== 'object') return null;
  return entry as T;
};

export const writeFormDraft = (slug: FormSlug, draft: unknown): void => {
  const drafts = readFormDrafts();
  drafts[slug] = draft;
  writeFormDrafts(drafts);
};

export const clearFormDraft = (slug: FormSlug): void => {
  const drafts = readFormDrafts();
  delete drafts[slug];
  writeFormDrafts(drafts);
};
