import type { ReactNode } from 'react';

export type FormQuestionItem = {
  kind: 'question';
  key: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  validate?: () => string | null;
};

export type FormSectionItem = {
  kind: 'section';
  key: string;
  title: string;
};

export type FormItem = FormQuestionItem | FormSectionItem;
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

const isQuestion = (item: FormItemInput): item is FormQuestionItem =>
  Boolean(item && item.kind === 'question');

export const numberFormItems = (
  items: readonly FormItemInput[],
): NumberedFormItem[] => {
  const visible = items.filter((item): item is FormItem => Boolean(item));
  const indices = new Map(
    visible
      .flatMap((item, position) => (isQuestion(item) ? [position] : []))
      .map((position, index) => [position, index + 1]),
  );
  return visible.map((item, position) =>
    item.kind === 'section'
      ? item
      : { ...item, index: String(indices.get(position)).padStart(2, '0') },
  );
};

export type FormErrors = Record<string, string>;

export const collectFormErrors = (
  items: readonly FormItemInput[],
): FormErrors =>
  Object.fromEntries(
    items.filter(isQuestion).flatMap((item) => {
      const message = item.validate?.();
      return message ? [[item.key, message]] : [];
    }),
  );

export const firstErrorKey = (
  items: readonly FormItemInput[],
  errors: FormErrors,
): string | null =>
  items.find(
    (item): item is FormQuestionItem =>
      isQuestion(item) && Boolean(errors[item.key]),
  )?.key ?? null;

export const requireText =
  (value: string, message: string) => (): string | null =>
    value.trim() ? null : message;

export const requireChoice =
  (value: string, message: string) => (): string | null =>
    value ? null : message;
