import { useLayoutEffect, useRef, useState } from 'react';
import { ImagePreview } from '~/components/ui/image-preview';
import { Bone } from '~/components/ui/skeleton';
import { useDocBase } from '~/contexts/DocBaseContext';
import { cn } from '~/lib/cn';
import { lookupImageSize } from '~/lib/imageSizes';
import type { MnImage } from '~/types/mdast';
import { resolveDocHref } from '~/utils/normalizeDocHref';

type Props = {
  mn: MnImage;
  presentation?: 'document' | 'gallery';
};

export const DocImage = ({ mn, presentation = 'document' }: Props) => {
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

  const gallery = presentation === 'gallery';
  const image = (
    <img
      ref={ref}
      src={src}
      alt={mn.alt ?? ''}
      className={cn(
        'block max-w-full',
        gallery ? 'max-h-full w-auto object-contain' : 'h-auto',
        !gallery && size && 'w-full',
        mn.className,
      )}
      loading="lazy"
      decoding="async"
      {...(size ? { width: size.width, height: size.height } : {})}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
    />
  );

  const frame = (
    <span
      className={cn(
        'relative block overflow-hidden',
        gallery
          ? 'flex h-48 items-center justify-center bg-paper p-2 sm:h-56'
          : 'max-w-full',
      )}
      style={
        !gallery && size
          ? {
              aspectRatio: `${size.width} / ${size.height}`,
              maxWidth: size.width,
            }
          : undefined
      }
    >
      {!loaded && (size || gallery) ? (
        <Bone className="absolute inset-0 h-full w-full rounded-md" />
      ) : null}
      {image}
    </span>
  );

  if (mn.preview) {
    return (
      <ImagePreview
        src={src}
        alt={mn.alt ?? ''}
        className={gallery ? 'h-full rounded-none' : 'my-[0.6rem] max-w-full'}
      >
        {frame}
      </ImagePreview>
    );
  }

  return (
    <span className={gallery ? 'block h-full' : 'my-[0.6rem] block'}>
      {frame}
    </span>
  );
};
const parserImage = (mn: MnImage) => <DocImage mn={mn} />;
export default parserImage;
