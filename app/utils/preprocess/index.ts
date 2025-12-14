import preprocessAdmonition from '~/utils/preprocess/preprocessAdmonition';
import preprocessTab from '~/utils/preprocess/preprocessTab';

export type Preprocess = (lines: string[]) => string[];

const preprocess = (text: string): string => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const preprocesses: Preprocess[] = [preprocessTab, preprocessAdmonition];
  return preprocesses.reduce((pre, cur) => cur(pre), lines).join('\n');
};

export default preprocess;
