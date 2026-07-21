import type { FormEvent, ReactNode } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  children: ReactNode;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
};

/**
 * Form body with errata-style rail: gradient spine + diamond cap.
 * Rail sits in the left gutter; content keeps clear of the page edge.
 */
export const FormStack = ({ children, onSubmit, className }: Props) => (
  <form
    className={cn('relative flex flex-col gap-9 pl-5', className)}
    onSubmit={onSubmit}
    noValidate
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-gradient-to-b from-primary to-[rgba(var(--brand-r),var(--brand-g),var(--brand-b),0.15)]"
    >
      <span className="absolute top-[-0.2rem] left-1/2 h-[0.45rem] w-[0.45rem] -translate-x-1/2 rotate-45 bg-primary" />
    </div>
    {children}
  </form>
);
