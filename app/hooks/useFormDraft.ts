import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearFormDraft,
  readFormDraft,
  writeFormDraft,
} from '~/lib/formDrafts';
import type { FormSlug } from '~/lib/formTypes';

type Options<T extends object> = {
  slug: FormSlug;
  defaults: T;
  /**
   * Navigation context (e.g. `?page=`). Non-empty seed values always win over
   * saved drafts — arriving from a doc's「问题反馈」must prefill.
   */
  seed?: Partial<T>;
};

const applySeed = <T extends object>(base: T, seed?: Partial<T>): T => {
  if (!seed) return base;
  let next: T | null = null;
  for (const [key, value] of Object.entries(seed)) {
    if (value == null || value === '') continue;
    if (base[key as keyof T] === value) continue;
    if (!next) next = { ...base };
    next[key as keyof T] = value as T[keyof T];
  }
  return next ?? base;
};

const mergeDraft = <T extends object>(
  defaults: T,
  saved: T | null,
  seed?: Partial<T>,
): T => applySeed({ ...defaults, ...(saved ?? {}) } as T, seed);

/**
 * Controlled draft for one form slug. All slugs share one localStorage record.
 * Values must be JSON-serializable (no File / Blob).
 */
export const useFormDraft = <T extends object>({
  slug,
  defaults,
  seed,
}: Options<T>) => {
  const [values, setValues] = useState<T>(() =>
    mergeDraft(defaults, readFormDraft<T>(slug), seed),
  );

  const ready = useRef(false);
  const skipPersist = useRef(false);
  const seedKey = seed ? JSON.stringify(seed) : '';

  useEffect(() => {
    ready.current = true;
  }, []);

  // SPA search-only navigations don't remount — re-apply seed when it changes.
  useEffect(() => {
    if (!seedKey) return;
    const parsed = JSON.parse(seedKey) as Partial<T>;
    setValues((prev) => applySeed(prev, parsed));
  }, [seedKey]);

  useEffect(() => {
    if (!ready.current) return;
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      writeFormDraft(slug, values);
    }, 200);
    return () => window.clearTimeout(id);
  }, [slug, values]);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clear = useCallback(() => {
    skipPersist.current = true;
    clearFormDraft(slug);
    setValues(applySeed({ ...defaults }, seed));
  }, [defaults, seed, slug]);

  return { values, setField, setValues, clear };
};
