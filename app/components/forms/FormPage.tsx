import type { FormEvent, ReactNode } from 'react';
import { FormDone } from '~/components/forms/FormDone';
import { FormError } from '~/components/forms/FormError';
import { FormQuestion } from '~/components/forms/FormQuestion';
import { FormShell } from '~/components/forms/FormShell';
import { FormStack } from '~/components/forms/FormStack';
import { SubmitProgressOverlay } from '~/components/forms/SubmitProgressOverlay';
import { Button } from '~/components/ui/button';
import {
  collectFormErrors,
  type FormItemInput,
  numberFormItems,
  questionDomId,
} from '~/lib/formItems';
import type { UploadProgress } from '~/lib/formSubmit';
import { FORM_META, type FormSlug } from '~/lib/formTypes';

export const DRAFT_NOTE = '未提交的内容会自动保存在本机，下次打开可继续填写。';
export const DRAFT_NOTE_WITH_FILES =
  '未提交的文字会自动保存在本机；文件仅在点击提交后串行上传。';

type Props = {
  slug: FormSlug;
  items: readonly FormItemInput[];
  /** Submission failures that belong to no single question. */
  alert: string | null;
  /** Set after the first submit attempt; keeps a pristine form quiet. */
  showErrors: boolean;
  done: boolean;
  submitting: boolean;
  progress: UploadProgress;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onAgain: () => void;
  submitDisabled?: boolean;
  footnote?: ReactNode;
};

/** Heading, numbered body, per-question errors and submit bar. */
export const FormPage = ({
  slug,
  items,
  alert,
  showErrors,
  done,
  submitting,
  progress,
  onSubmit,
  onAgain,
  submitDisabled,
  footnote = DRAFT_NOTE,
}: Props) => {
  const { title, description } = FORM_META[slug];
  const errors = showErrors ? collectFormErrors(items) : null;

  if (done) {
    return <FormDone title={title} lede={description} onAgain={onAgain} />;
  }

  return (
    <FormShell title={title} lede={description}>
      <SubmitProgressOverlay open={submitting} progress={progress} />
      <FormStack onSubmit={onSubmit}>
        {numberFormItems(items).map((item) =>
          item.kind === 'section' ? (
            <p
              key={item.key}
              className="mt-1 border-t border-line pt-4 font-display text-lg font-semibold text-ink"
            >
              {item.title}
            </p>
          ) : (
            <FormQuestion
              key={item.key}
              id={questionDomId(item.key)}
              index={item.index}
              label={item.label}
              required={item.required}
              hint={item.hint}
              error={errors?.[item.key]}
            >
              {item.children}
            </FormQuestion>
          ),
        )}

        {/* Field problems speak for themselves above; this is only for
            failures with no question to point at. */}
        {alert ? <FormError>{alert}</FormError> : null}

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || submitDisabled}
          >
            提交
          </Button>
          <p className="mt-2 text-xs text-muted">{footnote}</p>
        </div>
      </FormStack>
    </FormShell>
  );
};
