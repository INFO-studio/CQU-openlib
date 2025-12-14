import { match } from 'ts-pattern';
import { ADMONITION_END, ADMONITION_START, TAB } from '~/consts/placeholders';
import type { Preprocess } from '~/utils/preprocess/index';

const isAdmonitionHead = (line: string) =>
  /^!!!\s+\S+(\s+".*")?\s*$/.test(line);

type AdmonitionPreprocessState = {
  lines: string[];
  inAdmonition: boolean;
  continuousTabs: number;
};

const preprocessAdmonition: Preprocess = (lines) => {
  const admonitionPreprocessed = lines.reduce<AdmonitionPreprocessState>(
    (pre, cur) =>
      match({ pre, cur })
        .when(
          ({ pre, cur }) => !pre.inAdmonition && isAdmonitionHead(cur),
          ({ pre, cur }) => {
            pre.lines.push(ADMONITION_START, cur);
            pre.inAdmonition = true;
            return pre;
          },
        )
        .when(
          ({ pre, cur }) =>
            pre.inAdmonition && pre.continuousTabs === 0 && cur === TAB,
          ({ pre }) => {
            pre.lines.push(cur);
            pre.continuousTabs += 1;
            return pre;
          },
        )
        .when(
          ({ pre }) => pre.inAdmonition && pre.continuousTabs === 0,
          ({ pre, cur }) => {
            pre.lines.push(ADMONITION_END, cur);
            pre.inAdmonition = false;
            pre.continuousTabs += 0;
            return pre;
          },
        )
        .when(
          ({ pre }) => pre.inAdmonition,
          ({ pre, cur }) => {
            pre.lines.push(cur);
            pre.continuousTabs = 0;
            return pre;
          },
        )
        .otherwise(({ pre, cur }) => {
          pre.lines.push(cur);
          return pre;
        }),
    {
      lines: [],
      inAdmonition: false,
      continuousTabs: 0,
    },
  );
  if (admonitionPreprocessed.inAdmonition) {
    admonitionPreprocessed.lines.push(ADMONITION_END);
  }
  return admonitionPreprocessed.lines;
};
export default preprocessAdmonition;
