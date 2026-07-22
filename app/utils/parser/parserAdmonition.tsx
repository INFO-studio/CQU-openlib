import Admonition from '~/components/Admonition';
import type { MnAdmonition } from '~/types/mdast';
import parser from '~/utils/parser/index';

const parserAdmonition = (mn: MnAdmonition) => {
  const hasTitle = Boolean(mn.title?.length);
  const hasContent = Boolean(mn.children?.length);

  return (
    <Admonition
      type={mn.admonitionType}
      title={hasTitle ? mn.title?.map(parser) : undefined}
    >
      {hasContent ? mn.children?.map(parser) : undefined}
    </Admonition>
  );
};

export default parserAdmonition;
