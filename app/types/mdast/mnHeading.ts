import type { Mn } from '~/types/mdast/index';

export type MnHeading = {
  type: 'heading';
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  children: Mn[];
  /** Stable, document-unique fragment id assigned after the AST is assembled. */
  id?: string;
};
