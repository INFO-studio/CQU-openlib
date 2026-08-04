import type { Mn } from '.';

export type MnCollapseItem = {
  title: Mn[];
  children: Mn[];
};

export type MnCollapseGroup = {
  type: 'collapseGroup';
  items: MnCollapseItem[];
};
