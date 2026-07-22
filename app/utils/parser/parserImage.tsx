import { useDocBase } from '~/contexts/DocBaseContext';
import { cn } from '~/lib/cn';
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
      className={cn('my-[0.6rem] block h-auto max-w-full', mn.className)}
      loading="lazy"
    />
  );
};
const parserImage = (mn: MnImage) => <ParserImage mn={mn} />;
export default parserImage;
