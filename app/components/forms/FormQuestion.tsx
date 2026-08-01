import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

const labelClass = 'block text-[0.95rem] font-medium text-ink';
const hintClass = 'text-sm leading-relaxed text-muted';

type Props = {
  index: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  /** Scroll target when this question fails validation. */
  id?: string;
  /** Shown under the control once the user has attempted to submit. */
  error?: string;
};

export const FormQuestion = ({
  index,
  label,
  required,
  hint,
  children,
  id,
  error,
}: Props) => (
  <fieldset
    id={id}
    aria-invalid={error ? true : undefined}
    className="m-0 min-w-0 border-0 p-0 scroll-mt-24"
  >
    <legend className={labelClass}>
      <span className="mr-1.5 inline-block min-w-[1.6rem] font-mono text-xs tracking-wide text-muted">
        {index}
      </span>
      {label}
      {required ? (
        <span className="ml-1.5 inline-block rounded bg-primary-soft px-1.5 py-0.5 align-middle text-[0.7rem] font-semibold tracking-wide text-primary">
          必答
        </span>
      ) : null}
    </legend>
    {children}
    {error ? (
      <p className="mt-2 text-sm font-medium text-error">{error}</p>
    ) : null}
    {hint ? (
      <p className={cn(error ? 'mt-1' : 'mt-2', hintClass)}>{hint}</p>
    ) : null}
  </fieldset>
);
