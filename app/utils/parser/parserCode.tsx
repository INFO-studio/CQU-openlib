import CodeBlock from '~/components/ui/code-block';
import type { MnCode } from '~/types/mdast';

const parserCode = (mn: MnCode) => {
  const lang = mn.lang?.trim() || undefined;
  return <CodeBlock value={mn.value} lang={lang} />;
};

export default parserCode;
