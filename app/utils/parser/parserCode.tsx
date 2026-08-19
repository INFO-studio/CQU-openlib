import CodeBlock from '~/components/ui/code-block';
import { trackItemClick } from '~/lib/analytics';
import type { MnCode } from '~/types/mdast';

const parserCode = (mn: MnCode) => {
  const lang = mn.lang?.trim() || undefined;
  return (
    <CodeBlock
      value={mn.value}
      lang={lang}
      onCopied={() =>
        trackItemClick({ item_type: 'code_copy', lang: lang ?? 'plain' })
      }
    />
  );
};

export default parserCode;
