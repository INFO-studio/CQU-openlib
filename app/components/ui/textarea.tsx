import type { TextareaHTMLAttributes } from 'react';
import { fieldClass } from '~/components/ui/input';
import { cn } from '~/lib/cn';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = ({ className, ...rest }: Props) => (
  <textarea
    className={cn(fieldClass, 'min-h-[9rem] resize-y', className)}
    {...rest}
  />
);
