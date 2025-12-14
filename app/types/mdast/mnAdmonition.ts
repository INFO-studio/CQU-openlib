import type { Mn } from '.';
export type MnAdmonitionType =
  | 'note'
  | 'abstract'
  | 'info'
  | 'tip'
  | 'success'
  | 'question'
  | 'warning'
  | 'failure'
  | 'danger'
  | 'bug'
  | 'example'
  | 'quote';

export const isValidAdmonitionType = (
  type: string,
): type is MnAdmonitionType => {
  const validTypes: MnAdmonitionType[] = [
    'note',
    'abstract',
    'info',
    'tip',
    'success',
    'question',
    'warning',
    'failure',
    'danger',
    'bug',
    'example',
    'quote',
  ];
  return validTypes.includes(type as MnAdmonitionType);
};

export type MnAdmonition = {
  type: 'admonition';
  admonitionType: MnAdmonitionType;
  title?: Mn[];
  children?: Mn[];
};
