export type MnKbdKey = {
  /** Canonical key id used for CSS class (`key-ctrl`). */
  name: string;
  /** Visible label. */
  label: string;
};

/** pymdownx.keys — `++ctrl+f++` */
export type MnKbd = {
  type: 'kbd';
  keys: MnKbdKey[];
};
