import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '~/lib/cn';

type Variant = 'ghost' | 'soft' | 'icon' | 'primary';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};
const variants: Record<Variant, string> = {
  ghost:
    'inline-flex items-center justify-center gap-1.5 rounded px-2 py-1 text-sm text-muted hover:bg-mist hover:text-ink transition-colors',
  soft: 'inline-flex items-center justify-center gap-1.5 rounded px-2 py-1 text-sm text-ink bg-mist hover:bg-primary-soft transition-colors',
  icon: 'inline-flex h-8 w-8 items-center justify-center rounded text-icon hover:bg-mist hover:text-ink transition-colors',
  primary:
    'inline-flex items-center justify-center gap-1.5 rounded-md px-5 py-2.5 text-sm font-medium text-white bg-primary shadow-none transition-colors hover:bg-[var(--c-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50',
};
export const Button = ({
  variant = 'ghost',
  className,
  type = 'button',
  children,
  ...rest
}: Props) => {
  return (
    <button type={type} className={cn(variants[variant], className)} {...rest}>
      {children}
    </button>
  );
};
