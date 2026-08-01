/**
 * A form body is an ordered list of items. Display numbers, validation order
 * and error targeting are all derived from that list, so adding or hiding a
 * question never requires renumbering anything by hand.
 */

import type { ReactNode } from 'react';

export type FormQuestionItem = {
  kind: 'question';
  /** Stable within one form; also used as the DOM id for error scrolling. */
  key: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  /** Return a message to reject submission. Runs in list order. */
  validate?: () => string | null;
};

/** Unnumbered heading grouping the questions below it, e.g.「教材 2」. */
export type FormSectionItem = {
  kind: 'section';
  key: string;
  title: string;
};

export type FormItem = FormQuestionItem | FormSectionItem;

/** Falsy entries let callers write `shown && question({...})` inline. */
export type FormItemInput = FormItem | false | null | undefined;

export const question = (
  item: Omit<FormQuestionItem, 'kind'>,
): FormQuestionItem => ({ kind: 'question', ...item });

export const section = (key: string, title: string): FormSectionItem => ({
  kind: 'section',
  key,
  title,
});

export const questionDomId = (key: string) => `form-q-${key}`;

export type NumberedFormItem =
  | (FormQuestionItem & { index: string })
  | FormSectionItem;

/**
 * Number the questions by position. Hidden questions are absent from `items`
 * rather than skipped, so the sequence always closes up.
 */
export const numberFormItems = (
  items: readonly FormItemInput[],
): NumberedFormItem[] => {
  const numbered: NumberedFormItem[] = [];
  let n = 0;
  for (const item of items) {
    if (!item) continue;
    if (item.kind === 'section') {
      numbered.push(item);
      continue;
    }
    n += 1;
    numbered.push({ ...item, index: String(n).padStart(2, '0') });
  }
  return numbered;
};

/** Messages keyed by question key; empty when the form is submittable. */
export type FormErrors = Record<string, string>;

/**
 * Run every validator. Recomputed on each render so a fixed field clears its
 * message immediately, without waiting for another submit.
 */
export const collectFormErrors = (
  items: readonly FormItemInput[],
): FormErrors => {
  const errors: FormErrors = {};
  for (const item of items) {
    if (!item || item.kind !== 'question' || !item.validate) continue;
    const message = item.validate();
    if (message) errors[item.key] = message;
  }
  return errors;
};

/** Key of the earliest failing question, for scrolling the user to it. */
export const firstErrorKey = (
  items: readonly FormItemInput[],
  errors: FormErrors,
): string | null => {
  for (const item of items) {
    if (!item || item.kind !== 'question') continue;
    if (errors[item.key]) return item.key;
  }
  return null;
};

/** Reject blank input for a required text question. */
export const requireText =
  (value: string, message: string) => (): string | null =>
    value.trim() ? null : message;

/** Reject an unselected choice question. */
export const requireChoice =
  (value: string, message: string) => (): string | null =>
    value ? null : message;
