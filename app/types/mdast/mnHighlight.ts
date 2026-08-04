import type { Mn } from '.';

export type MnHighlight = {
  type: 'highlight';
  tone?: 'danger';
  children?: Mn[];
};
