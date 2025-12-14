import type { Mn } from '~/types/mdast/index';

export type MnListItem = {
  type: 'listItem';
  spread: boolean;
  checked: null | boolean;
  children: Mn[];
};
