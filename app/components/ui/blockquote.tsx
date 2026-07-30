import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  children: ReactNode;
  className?: string;
};

export const Blockquote = ({ children, className }: Props) => (
  <blockquote
    className={cn(
      'cquol-blockquote my-[0.6rem] border-l-2 border-l-primary-soft pl-[0.85rem] text-muted',
      className,
    )}
  >
    {children}
  </blockquote>
);
