import type { MnCode } from '~/types/mdast';

const parserCode = (mn: MnCode) => {
  const lang = mn.lang?.trim() || undefined;
  return (
    <pre data-language={lang}>
      <code className={lang ? `language-${lang}` : undefined}>{mn.value}</code>
    </pre>
  );
};

export default parserCode;
