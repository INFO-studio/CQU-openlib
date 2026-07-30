import type { Preprocess } from '~/utils/preprocess/index';

/** Drop HTML comments authors leave in source (e.g. `<!--TODO-->`). */
const stripHtmlComments: Preprocess = (lines) => {
  const text = lines.join('\n').replace(/<!--[\s\S]*?-->/g, '');
  return text.split('\n');
};

export default stripHtmlComments;
