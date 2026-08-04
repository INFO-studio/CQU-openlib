import type { ReactNode } from 'react';
import { cn } from '~/lib/cn';

export type ImageGalleryItem = {
  key: string;
  image: ReactNode;
  caption: ReactNode;
};

type Props = {
  items: ImageGalleryItem[];
  className?: string;
};

export const ImageGallery = ({ items, className }: Props) => (
  <div
    className={cn(
      'cquol-image-gallery my-3 grid grid-cols-1 gap-3 sm:grid-cols-2',
      className,
    )}
  >
    {items.map((item) => (
      <figure
        key={item.key}
        className="m-0 flex min-w-0 flex-col overflow-hidden rounded-md border border-line bg-panel"
      >
        <div className="min-h-0 flex-1">{item.image}</div>
        <figcaption className="border-t border-line px-3 py-2 text-xs leading-relaxed text-muted">
          {item.caption}
        </figcaption>
      </figure>
    ))}
  </div>
);
