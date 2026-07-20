import { useDocBase } from '~/contexts/DocBaseContext';
import type { MnImage } from '~/types/mdast';
import { resolveDocHref } from '~/utils/normalizeDocHref';

const ParserImage = ({ mn }: { mn: MnImage }) => {
  const base = useDocBase();
  const raw = mn.url || '';
  const src =
    raw.startsWith('http') ||
    raw.startsWith('//') ||
    raw.startsWith('data:') ||
    raw.startsWith('/')
      ? raw
      : resolveDocHref(raw, base);
  return (
    <img
      src={src}
      alt={mn.alt ?? ''}
      title={mn.title ?? undefined}
      loading="lazy"
    />
  );
};
const parserImage = (mn: MnImage) => <ParserImage mn={mn} />;
export default parserImage;
