import { Fragment } from 'react';
import { cn } from '~/lib/cn';

export type KbdKey = {
  name: string;
  label: string;
};

type Props = {
  keys: readonly KbdKey[];
  className?: string;
};

export const Kbd = ({ keys, className }: Props) => (
  <span
    className={cn(
      'cquol-kbd inline-flex items-center gap-[0.15rem] align-[0.05em]',
      className,
    )}
  >
    {keys.map((key, i) => (
      <Fragment key={`${key.name}-${i}`}>
        {i > 0 ? (
          <span className="cquol-kbd__sep select-none text-[0.7rem] leading-none text-muted">
            +
          </span>
        ) : null}
        <kbd className={`cquol-kbd__key docs-kbd key-${key.name}`}>
          {key.label}
        </kbd>
      </Fragment>
    ))}
  </span>
);
