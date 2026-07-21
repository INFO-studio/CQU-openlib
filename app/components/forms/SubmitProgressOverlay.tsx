import { useEffect } from 'react';
import { ActivitySpinner } from '~/components/ui/activity-spinner';
import type { UploadProgress } from '~/lib/formSubmit';

type Props = {
  open: boolean;
  progress: UploadProgress;
};

/**
 * Full-viewport submit veil: spinner only when no files;
 * spinner + short caption when uploading / posting after files.
 */
export const SubmitProgressOverlay = ({ open, progress }: Props) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const caption =
    progress.fileTotal > 0
      ? progress.phase === 'upload'
        ? `上传文件中...${progress.fileIndex}/${progress.fileTotal}`
        : '提交表单中...'
      : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--c-backdrop)] px-6 backdrop-blur-md"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label="正在提交"
    >
      <div className="flex flex-col items-center gap-4 text-primary">
        <ActivitySpinner size={36} label="正在提交" />
        {caption ? (
          <p className="text-center text-sm text-muted">{caption}</p>
        ) : null}
      </div>
    </div>
  );
};
