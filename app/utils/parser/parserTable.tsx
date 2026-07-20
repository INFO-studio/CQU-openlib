import type { CSSProperties } from 'react';
import type {
  MnTable,
  MnTableAlign,
  MnTableCell,
  MnTableRow,
} from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserTableCell = (
  mn: MnTableCell,
  tag: 'th' | 'td',
  align?: MnTableAlign,
) => {
  const Tag = tag;
  const style: CSSProperties | undefined = align
    ? { textAlign: align }
    : undefined;
  return <Tag style={style}>{mn.children.map(parser)}</Tag>;
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
    <table>
      <tbody>
        {mn.children.map((row, i) => parserTableRow(row, i, mn.align))}
      </tbody>
    </table>
  </div>
);

export default parserTable;
