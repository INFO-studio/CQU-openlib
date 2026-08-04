import { describe, expect, it } from 'vite-plus/test';
import {
  IMAGE_GALLERY_END,
  IMAGE_GALLERY_START,
} from '~/utils/preprocess/placeholders';
import preprocessImageGallery from '~/utils/preprocess/preprocessImageGallery';

describe('preprocessImageGallery', () => {
  it('replaces explicit component boundaries and leaves images untouched', () => {
    expect(
      preprocessImageGallery([
        '    <ImageGallery>',
        '    ![证据](a.webp){:preview}',
        '    </ImageGallery>',
      ]),
    ).toEqual([
      IMAGE_GALLERY_START,
      '    ![证据](a.webp){:preview}',
      IMAGE_GALLERY_END,
    ]);
  });

  it('does not accept self-closing or misspelled tags', () => {
    expect(
      preprocessImageGallery([
        '<ImageGallery />',
        '<imagegallery>',
        '</imagegallery>',
      ]),
    ).toEqual(['<ImageGallery />', '<imagegallery>', '</imagegallery>']);
  });
});
