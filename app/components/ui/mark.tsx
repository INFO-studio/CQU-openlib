import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'danger';
};

export const Mark = ({ children, className, tone = 'default' }: Props) => (
  <mark
    className={cn(
      'cquol-mark rounded-[0.15em] px-[0.15em] py-[0.05em]',
      tone === 'danger'
        ? 'bg-error-soft font-semibold text-error'
        : 'bg-primary-soft text-ink',
      className,
    )}
  >
    {children}
  </mark>
);
