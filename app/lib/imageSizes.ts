import manifest from '../../metadata/image-sizes.json';

export type ImageSize = { width: number; height: number };
const sizes: Record<string, number[]> = manifest;

const decodedEntry = (src: string): number[] | undefined => {
  try {
    return sizes[decodeURI(src)];
  } catch {
    return undefined;
  }
};

export const lookupImageSize = (src: string): ImageSize | null => {
  const [width, height] = sizes[src] ?? decodedEntry(src) ?? [];
  return width && height ? { width, height } : null;
};
