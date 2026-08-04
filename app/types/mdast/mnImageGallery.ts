import type { MnImage } from '~/types/mdast/mnImage';

export type MnImageGallery = {
  type: 'imageGallery';
  images: MnImage[];
};
