import type { InputHTMLAttributes } from 'react';
import { cn } from '~/lib/cn';

/** Shared with Textarea — single focus cue (border only). */
export const fieldClass =
  'mt-2 w-full rounded-md border border-line bg-panel px-3.5 py-2.5 text-ink outline-none transition-colors focus:border-primary focus-visible:outline-none';

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, type = 'text', ...rest }: Props) => (
  <input type={type} className={cn(fieldClass, className)} {...rest} />
);
