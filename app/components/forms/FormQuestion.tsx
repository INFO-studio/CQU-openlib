import type { ReactNode } from 'react';

export const formLabelClass = 'block text-[0.95rem] font-medium text-ink';
export const formHintClass = 'mt-2 text-sm leading-relaxed text-muted';

type Props = {
  index: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
};

export const FormQuestion = ({
  index,
  label,
  required,
  hint,
  children,
}: Props) => (
  <fieldset
    className={
      hint ? 'm-0 min-w-0 border-0 p-0 pb-3' : 'm-0 min-w-0 border-0 p-0'
    }
  >
    <legend className={formLabelClass}>
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
    {hint ? <p className={formHintClass}>{hint}</p> : null}
  </fieldset>
);
