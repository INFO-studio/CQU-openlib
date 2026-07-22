import type { CSSProperties } from 'react';
import { cn } from '~/lib/cn';
import type {
  MnTable,
  MnTableAlign,
  MnTableCell,
  MnTableRow,
} from '~/types/mdast';
import parser from '~/utils/parser/index';

const cellClass = 'border-b border-line px-2 py-[0.35rem] text-left';

const parserTableCell = (
  mn: MnTableCell,
  tag: 'th' | 'td',
  align?: MnTableAlign,
) => {
  const Tag = tag;
  const style: CSSProperties | undefined = align
    ? { textAlign: align }
    : undefined;
  return (
    <Tag
      style={style}
      className={cn(cellClass, tag === 'th' && 'font-semibold text-muted')}
    >
      {mn.children.map(parser)}
    </Tag>
  );
};

const parserTableRow = (
  mn: MnTableRow,
  rowIndex: number,
  align?: Array<'left' | 'right' | 'center' | null>,
) => {
  const isHeader = rowIndex === 0;
  return (
    <tr>
      {mn.children.map((cell, i) =>
        parserTableCell(cell, isHeader ? 'th' : 'td', align?.[i] ?? null),
      )}
    </tr>
  );
};

const parserTable = (mn: MnTable) => (
  <div className="overflow-x-auto">
    <table className="my-[0.6rem] w-full border-collapse text-[0.9rem]">
      <tbody>
        {mn.children.map((row, i) => parserTableRow(row, i, mn.align))}
      </tbody>
    </table>
  </div>
);

export default parserTable;
