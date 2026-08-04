export type MnImage = {
  type: 'image';
  url: string;
  title?: string | null;
  alt?: string | null;
  /** MkDocs `{.class}` attribute list. */
  className?: string;
  /** Opt in to the fullscreen image viewer. */
  preview?: boolean;
};
