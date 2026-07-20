import type { Mn } from '.';

export type MnFootnoteReference = {
  type: 'footnoteReference';
  identifier: string;
  label?: string | null;
};

export type MnFootnoteDefinition = {
  type: 'footnoteDefinition';
  identifier: string;
  label?: string | null;
  children: Mn[];
};
