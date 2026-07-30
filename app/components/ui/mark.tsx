import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  children: ReactNode;
  className?: string;
};

export const Mark = ({ children, className }: Props) => (
  <mark
    className={cn(
      'cquol-mark rounded-[0.15em] bg-primary-soft px-[0.15em] py-[0.05em] text-ink',
      className,
    )}
  >
    {children}
  </mark>
);
