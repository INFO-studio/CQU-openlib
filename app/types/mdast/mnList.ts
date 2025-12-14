import type { Mn } from '~/types/mdast/index';

export type MnList = {
  type: 'list';
  spread: boolean;
  children: Mn[];
} & (
  | {
      ordered: true;
      start: number;
    }
  | {
      ordered: false;
      start: null;
    }
);
