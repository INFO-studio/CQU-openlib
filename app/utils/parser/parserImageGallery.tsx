import { ImageGallery } from '~/components/ui/image-gallery';
import type { MnImageGallery } from '~/types/mdast';
import { DocImage } from '~/utils/parser/parserImage';

const parserImageGallery = (mn: MnImageGallery) => (
  <ImageGallery
    items={mn.images.map((image, index) => ({
      key: `${image.url}-${index}`,
      image: <DocImage mn={image} presentation="gallery" />,
      caption: image.alt || '图片',
    }))}
  />
);

export default parserImageGallery;
