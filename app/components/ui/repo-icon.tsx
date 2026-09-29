import type { CSSProperties } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  icon: string;
  className?: string;
};

export const RepoIcon = ({ icon, className }: Props) => {
  const maskStyle: CSSProperties = {
    backgroundColor: 'currentColor',
    WebkitMaskImage: `url(${icon})`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskImage: `url(${icon})`,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
  };

  return (
    <span
      className={cn('inline-block h-4 w-4 shrink-0', className)}
      style={maskStyle}
      aria-hidden
    />
  );
};
