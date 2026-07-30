import type { CSSProperties, ReactNode } from 'react';
import { cn } from '~/lib/cn';

export type TableAlign = 'left' | 'right' | 'center' | null;

type CellProps = {
  tag?: 'th' | 'td';
  align?: TableAlign;
  children: ReactNode;
  className?: string;
};

export const TableCell = ({
  tag = 'td',
  align,
  children,
  className,
}: CellProps) => {
  const Tag = tag;
  const style: CSSProperties | undefined = align
    ? { textAlign: align }
    : undefined;
  return (
    <Tag
      style={style}
      className={cn(
        'cquol-table__cell border-b border-line px-2 py-[0.35rem] text-left',
        tag === 'th' && 'font-semibold text-muted',
        className,
      )}
    >
      {children}
    </Tag>
  );
};

type RowProps = {
  children: ReactNode;
  className?: string;
};

export const TableRow = ({ children, className }: RowProps) => (
  <tr className={cn('cquol-table__row', className)}>{children}</tr>
);

type Props = {
  children: ReactNode;
  className?: string;
};

export const Table = ({ children, className }: Props) => (
  <div className={cn('cquol-table overflow-x-auto', className)}>
    <table className="cquol-table__table my-[0.6rem] w-full border-collapse text-[0.9rem]">
      <tbody>{children}</tbody>
    </table>
  </div>
);
