import { TAB } from '~/consts/placeholders';
import type { Preprocess } from '~/utils/preprocess';

const preprocessTab: Preprocess = (lines) =>
  lines.flatMap((line) => (/^ {4}/.test(line) ? [TAB, line.slice(4)] : [line]));
export default preprocessTab;
