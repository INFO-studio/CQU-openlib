import type { Mn } from '.';

export type MnTableAlign = 'left' | 'right' | 'center' | null;

export type MnTable = {
  type: 'table';
  align?: MnTableAlign[];
  children: MnTableRow[];
};

export type MnTableRow = {
  type: 'tableRow';
  children: MnTableCell[];
};

export type MnTableCell = {
  type: 'tableCell';
  children: Mn[];
};
