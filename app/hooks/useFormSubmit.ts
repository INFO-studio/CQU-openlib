import { useCallback, useState } from 'react';
import {
  collectFormErrors,
  type FormItemInput,
  firstErrorKey,
  questionDomId,
} from '~/lib/formItems';
import {
  IDLE_UPLOAD_PROGRESS,
  type StagingFileRef,
  submitFormWithFiles,
  type UploadProgress,
} from '~/lib/formSubmit';
import type { FormSlug } from '~/lib/formTypes';

type SubmitOptions<TPayload> = {
  /** Validated before anything is uploaded. */
  items: readonly FormItemInput[];
  files?: File[];
  buildPayload: (uploaded: StagingFileRef[]) => TPayload;
  /** Clear drafts and local file state; runs only after the API accepts. */
  onSuccess?: () => void;
};

/**
 * Validation → serial upload → POST /form.
 *
 * Field messages stay hidden until the first submit attempt, then track the
 * draft live; `alert` carries only failures with no field to point at.
 */
export const useFormSubmit = (type: FormSlug) => {
  const [alert, setAlert] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] =
    useState<UploadProgress>(IDLE_UPLOAD_PROGRESS);

  const submit = useCallback(
    async <TPayload>({
      items,
      files = [],
      buildPayload,
      onSuccess,
    }: SubmitOptions<TPayload>) => {
      if (submitting) return;
      setAlert(null);

      const invalid = firstErrorKey(items, collectFormErrors(items));
      if (invalid) {
        setShowErrors(true);
        document
          .getElementById(questionDomId(invalid))
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setShowErrors(false);

      setSubmitting(true);
      setProgress(
        files.length
          ? { phase: 'upload', fileIndex: 1, fileTotal: files.length }
          : IDLE_UPLOAD_PROGRESS,
      );

      try {
        await submitFormWithFiles({
          type,
          files,
          onProgress: setProgress,
          buildPayload,
        });
        onSuccess?.();
        setDone(true);
      } catch (err) {
        setAlert(err instanceof Error ? err.message : '提交失败，请稍后重试');
      } finally {
        setSubmitting(false);
        setProgress(IDLE_UPLOAD_PROGRESS);
      }
    },
    [submitting, type],
  );

  const writeAgain = useCallback(() => {
    setDone(false);
    setShowErrors(false);
    setAlert(null);
  }, []);

  return { alert, showErrors, done, submitting, progress, submit, writeAgain };
};
