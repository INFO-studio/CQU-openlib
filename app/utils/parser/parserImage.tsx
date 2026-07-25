import { useLayoutEffect, useRef, useState } from 'react';
import { Bone } from '~/components/Skeleton';
import { useDocBase } from '~/contexts/DocBaseContext';
import { cn } from '~/lib/cn';
import { lookupImageSize } from '~/lib/imageSizes';
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
  const size = lookupImageSize(src);
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // A cached image can finish before React attaches onLoad, which would leave
  // the skeleton up for good.
  useLayoutEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  const image = (
    <img
      ref={ref}
      src={src}
      alt={mn.alt ?? ''}
      className={cn(
        'block h-auto max-w-full',
        size ? 'w-full' : 'my-[0.6rem]',
        mn.className,
      )}
      loading="lazy"
      decoding="async"
      {...(size ? { width: size.width, height: size.height } : {})}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  );

  // Without intrinsic dimensions there is no box to reserve, so a skeleton
  // would just be a second layout shift.
  if (!size) return image;

  return (
    <span
      className="relative my-[0.6rem] block"
      style={{
        aspectRatio: `${size.width} / ${size.height}`,
        maxWidth: size.width,
      }}
    >
      {loaded ? null : (
        <Bone className="absolute inset-0 h-full w-full rounded-md" />
      )}
      {image}
    </span>
  );
};
const parserImage = (mn: MnImage) => <ParserImage mn={mn} />;
export default parserImage;
