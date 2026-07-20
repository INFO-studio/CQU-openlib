import preprocessAdmonition from '~/utils/preprocess/preprocessAdmonition';
import preprocessContentTabs from '~/utils/preprocess/preprocessContentTabs';
import preprocessHtmlBlocks from '~/utils/preprocess/preprocessHtmlBlocks';
import stripHtmlComments from '~/utils/preprocess/stripHtmlComments';

export type Preprocess = (lines: string[]) => string[];

const preprocess = (text: string): string => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  // Order matters:
  // 1) content-tabs before other transforms (nested `===` needs indent)
  // 2) isolate HTML so it cannot swallow markers
  // 3) admonition fencing (strips 4-space body only inside !!! blocks)
  // NOTE: no global preprocessTab — it flattened nested markdown lists.
  const preprocesses: Preprocess[] = [
    stripHtmlComments,
    preprocessContentTabs,
    preprocessHtmlBlocks,
    preprocessAdmonition,
  ];
  return preprocesses.reduce((pre, cur) => cur(pre), lines).join('\n');
};

export default preprocess;
