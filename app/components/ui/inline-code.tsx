import { cn } from '~/lib/cn';

type Props = {
  value: string;
  className?: string;
};

export const InlineCode = ({ value, className }: Props) => (
  <code
    className={cn(
      'cquol-inline-code rounded-[0.2em] bg-code-bg px-[0.3em] py-[0.05em] font-mono text-[0.875em] text-ink',
      className,
    )}
  >
    {value}
  </code>
);
