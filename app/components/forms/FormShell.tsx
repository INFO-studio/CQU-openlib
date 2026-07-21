import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  title: string;
  lede: string;
  children: ReactNode;
  className?: string;
};

export const FormShell = ({ title, lede, children, className }: Props) => {
  return (
    <div className={cn('w-full', className)}>
      <header>
        <h1 className="font-display m-0 text-[1.75rem] leading-tight font-semibold text-ink sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-3 mb-0 max-w-prose text-[0.98rem] leading-relaxed text-muted">
          {lede}
        </p>
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
};
