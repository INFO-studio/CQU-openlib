import type { Mn } from '.';

/** GFM strikethrough (`~~text~~`) */
export type MnDelete = {
  type: 'delete';
  children: Mn[];
};
