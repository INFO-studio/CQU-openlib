import type { Mn } from '~/types/mdast/index';

export type MnLink = {
  type: 'link';
  title: string | null;
  url: string | null;
  children: Mn[];
};
