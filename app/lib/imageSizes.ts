// Written by tools/image/optimize.ts. Inlined rather than fetched: 78 entries
// cost far less than the round trip, and the renderer needs them before layout.
import manifest from '../../metadata/image-sizes.json';

export type ImageSize = { width: number; height: number };

const sizes: Record<string, number[]> = manifest;

/** Intrinsic size of a local doc image, or null when it is not in the manifest. */
export const lookupImageSize = (src: string): ImageSize | null => {
  let entry = sizes[src];
  if (!entry) {
    try {
      entry = sizes[decodeURI(src)];
    } catch {
      // Malformed escape — treat as unknown.
    }
  }
  const [width, height] = entry ?? [];
  return width && height ? { width, height } : null;
};
