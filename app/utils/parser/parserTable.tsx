import { Table, TableCell, TableRow } from '~/components/ui/table';
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
) => (
  <TableCell tag={tag} align={align}>
    {mn.children.map(parser)}
  </TableCell>
);

const parserTableRow = (
  mn: MnTableRow,
  rowIndex: number,
  align?: Array<'left' | 'right' | 'center' | null>,
) => {
  const isHeader = rowIndex === 0;
  return (
    <TableRow>
      {mn.children.map((cell, i) =>
        parserTableCell(cell, isHeader ? 'th' : 'td', align?.[i] ?? null),
      )}
    </TableRow>
  );
};

const parserTable = (mn: MnTable) => (
  <Table>{mn.children.map((row, i) => parserTableRow(row, i, mn.align))}</Table>
);

export default parserTable;
