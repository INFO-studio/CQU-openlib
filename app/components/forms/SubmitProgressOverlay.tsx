import { useEffect } from 'react';
import type { UploadProgress } from '~/lib/formSubmit';

type Props = {
  open: boolean;
  progress: UploadProgress;
};

const R = 54;
const C = 2 * Math.PI * R;

/**
 * Full-viewport submit veil: soft blur + one breathing circular progress.
 * Brand blue only — no extra chrome.
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

  const pct = Math.round(Math.min(1, Math.max(0, progress.ratio)) * 100);
  const offset = C * (1 - Math.min(1, Math.max(0, progress.ratio)));
  const done = progress.ratio >= 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--c-backdrop)] px-6 backdrop-blur-xl"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label="正在提交"
    >
      <div className="relative flex w-full max-w-[16rem] flex-col items-center">
        <div className="relative grid size-[9.5rem] place-items-center">
          <span className="submit-pulse absolute inset-[12%] rounded-full bg-primary-soft" aria-hidden="true" />
          <svg
            className="size-full -rotate-90"
            viewBox="0 0 128 128"
            aria-hidden="true"
          >
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="var(--c-line)"
              strokeWidth="6"
            />
            <circle
              cx="64"
              cy="64"
              r={R}
              fill="none"
              stroke="var(--c-primary)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              className="transition-[stroke-dashoffset] duration-300 ease-out"
            />
            {!done ? (
              <circle
                cx="64"
                cy="10"
                r="3.2"
                fill="var(--c-primary)"
                className="submit-orbit origin-[64px_64px]"
                opacity={0.85}
              />
            ) : null}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-2xl font-semibold tracking-tight text-ink tabular-nums">
              {pct}
              <span className="text-base font-medium text-muted">%</span>
            </span>
          </div>
        </div>

        <p className="mt-6 font-display text-xl font-semibold tracking-wide text-ink">
          提交中
        </p>
        <p className="mt-2 text-center text-sm text-muted">{progress.label}</p>
      </div>

      <style>{`
        @keyframes submit-pulse {
          0%, 100% { transform: scale(0.92); opacity: 0.55; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        @keyframes submit-orbit {
          to { transform: rotate(360deg); }
        }
        .submit-pulse {
          animation: submit-pulse 2.4s ease-in-out infinite;
        }
        .submit-orbit {
          animation: submit-orbit 3.2s linear infinite;
          transform-origin: 64px 64px;
        }
        @media (prefers-reduced-motion: reduce) {
          .submit-pulse,
          .submit-orbit {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
};
