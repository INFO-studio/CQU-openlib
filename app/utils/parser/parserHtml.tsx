import parse from 'html-react-parser';
import type { ReactNode } from 'react';
import HomeBookmarks from '~/components/HomeBookmarks';
import type { MnHtml } from '~/types/mdast';

/**
 * PascalCase self-closing tags in markdown (`<HomeBookmarks />`) map here.
 * Keep the registry small — docs should stay mostly markdown.
 */
const DOC_COMPONENTS: Record<string, () => ReactNode> = {
  HomeBookmarks: () => <HomeBookmarks />,
};

const COMPONENT_TAG = /^<([A-Z][A-Za-z0-9]*)\s*\/>\s*$/;

const parserHtml = (mn: MnHtml) => {
  const match = mn.value.trim().match(COMPONENT_TAG);
  if (match) {
    const render = DOC_COMPONENTS[match[1]!];
    if (render) return render();
  }
  return <>{parse(mn.value)}</>;
};

export default parserHtml;
