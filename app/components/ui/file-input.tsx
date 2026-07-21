import {
  type ChangeEvent,
  type DragEvent,
  useId,
  useRef,
  useState,
} from 'react';
import { cn } from '~/lib/cn';

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  hint?: string;
  className?: string;
};

export const FileInput = ({
  file,
  onChange,
  accept = '.pdf,.epub,.zip,.rar,.7z,image/*,.md,.txt',
  hint = '点击选择，或拖拽文件到此处',
  className,
}: Props) => {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null;
    onChange(next);
    e.target.value = '';
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer.types.includes('Files')) setDragging(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    const next = e.dataTransfer.files?.[0] ?? null;
    if (next) onChange(next);
  };

  return (
    <div className={cn('mt-2 w-full', className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="sr-only"
        accept={accept}
        onChange={onPick}
      />

      <button
        type="button"
        aria-label={file ? `已选文件 ${file.name}，点击重新选择` : '选择或拖拽文件'}
        onClick={() => inputRef.current?.click()}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={cn(
          'file-drop relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed px-4 py-8 text-center transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          dragging
            ? 'scale-[1.015] border-primary bg-primary-soft shadow-[0_0_0_4px_var(--c-primary-soft)]'
            : file
              ? 'border-primary/45 bg-primary-faint hover:border-primary'
              : 'border-line bg-panel hover:border-primary/40 hover:bg-mist',
        )}
      >
        {/* Drag ripple */}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--c-primary-soft),transparent_68%)] transition-opacity duration-300',
            dragging ? 'opacity-100' : 'opacity-0',
          )}
        />

        <span
          aria-hidden="true"
          className={cn(
            'relative grid size-11 place-items-center rounded-full border transition-transform duration-300',
            dragging
              ? 'scale-110 border-primary bg-panel text-primary'
              : 'border-line bg-panel text-muted',
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={cn(
              'size-5 transition-transform duration-300',
              dragging && '-translate-y-0.5',
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 16V7" />
            <path d="M8.5 10.5 12 7l3.5 3.5" />
            <path d="M5 16.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" />
          </svg>
        </span>

        {file ? (
          <>
            <span className="relative max-w-full truncate text-sm font-medium text-ink">
              {file.name}
            </span>
            <span className="relative text-xs text-muted">
              {(file.size / 1024).toFixed(file.size >= 1024 * 100 ? 0 : 1)} KB ·
              点击更换，或拖入新文件
            </span>
          </>
        ) : (
          <>
            <span className="relative text-sm font-medium text-ink">
              {dragging ? '松开以上传' : '选择文件'}
            </span>
            <span className="relative text-xs text-muted">{hint}</span>
          </>
        )}
      </button>

      {file ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
            onClick={() => onChange(null)}
          >
            清除文件
          </button>
        </div>
      ) : null}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .file-drop {
            transition: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};
