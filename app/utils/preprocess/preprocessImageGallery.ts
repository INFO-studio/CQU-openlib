import type { Preprocess } from '~/utils/preprocess';
import {
  IMAGE_GALLERY_END,
  IMAGE_GALLERY_START,
} from '~/utils/preprocess/placeholders';

/** Turn explicit gallery component boundaries into remark-safe sentinels. */
const preprocessImageGallery: Preprocess = (lines) =>
  lines.map((line) => {
    const marker = line.trim();
    if (marker === '<ImageGallery>') return IMAGE_GALLERY_START;
    if (marker === '</ImageGallery>') return IMAGE_GALLERY_END;
    return line;
  });

export default preprocessImageGallery;
