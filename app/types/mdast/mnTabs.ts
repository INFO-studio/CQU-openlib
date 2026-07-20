import type { Mn } from '.';

export type MnTabItem = {
  title: Mn[];
  children: Mn[];
};

export type MnTabs = {
  type: 'tabs';
  items: MnTabItem[];
};
