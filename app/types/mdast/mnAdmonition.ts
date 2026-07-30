import type { AdmonitionType } from '~/utils/admonition';
import type { Mn } from '.';

export type MnAdmonitionType = AdmonitionType;

export type MnAdmonition = {
  type: 'admonition';
  admonitionType: MnAdmonitionType;
  title?: Mn[];
  children?: Mn[];
  /** Material `???` / `???+`; omit for plain `!!!`. */
  collapse?: 'closed' | 'open';
};
