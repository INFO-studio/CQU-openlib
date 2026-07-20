import type { Preprocess } from '~/utils/preprocess/index';

/** Drop HTML comments that MkDocs embeds for tooling (e.g. updateLog). */
const stripHtmlComments: Preprocess = (lines) => {
  const text = lines.join('\n').replace(/<!--[\s\S]*?-->/g, '');
  return text.split('\n');
};

export default stripHtmlComments;
