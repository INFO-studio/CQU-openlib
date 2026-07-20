import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { cn } from '~/lib/cn';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
};
export const TextLink = ({ className, children, ...rest }: Props) => {
  return (
    <a
      className={cn(
        'text-ink/90 no-underline hover:text-primary transition-colors',
        className,
      )}
      {...rest}
    >
      {children}
    </a>
  );
};
