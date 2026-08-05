import Admonition from '~/components/ui/admonition';
import { trackItemClick } from '~/lib/analytics';
import type { MnAdmonition } from '~/types/mdast';
import { mdastText } from '~/utils/mdastText';
import parser from '~/utils/parser/index';

const parserAdmonition = (mn: MnAdmonition) => {
  const hasTitle = Boolean(mn.title?.length);
  const hasContent = Boolean(mn.children?.length);

  return (
    <Admonition
      type={mn.admonitionType}
      title={hasTitle ? mn.title?.map(parser) : undefined}
      collapse={mn.collapse}
      onToggle={
        mn.collapse
          ? (open) =>
              trackItemClick({
                item_type: 'collapse',
                variant: 'admonition',
                title: mdastText(mn.title) || mn.admonitionType,
                open,
              })
          : undefined
      }
    >
      {hasContent ? mn.children?.map(parser) : undefined}
    </Admonition>
  );
};

export default parserAdmonition;
