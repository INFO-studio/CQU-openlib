/** Shell dimensions, emitted as `--layout-*` and mirrored into uno's theme. */
export const layout = {
  header: '3.25rem',
  sidebar: '15rem',
  toc: '11rem',
  /** Equal gutter between sidebar ↔ main ↔ toc */
  shell: '2rem',
} as const;

export const layoutVarNames = Object.keys(layout).map((k) => `--layout-${k}`);

export const spacing = {
  ...Object.fromEntries(
    Object.keys(layout).map((k) => [k, `var(--layout-${k})`]),
  ),
  /** Toc starts a hair lower than the sidebar so their first lines align. */
  'header-toc': 'calc(var(--layout-header) + 0.35rem)',
};

/** `h-*` and `min-h-*` read their own theme keys, never spacing. */
export const height = {
  header: 'var(--layout-header)',
  /** Sticky columns fill whatever the header leaves. */
  'under-header': 'calc(100vh - var(--layout-header))',
  'under-header-toc': 'calc(100vh - var(--layout-header) - 0.5rem)',
};

export const minHeight = { header: 'var(--layout-header)' };

export const layoutCss = `:root {
${Object.entries(layout)
  .map(([k, v]) => `  --layout-${k}: ${v};`)
  .join('\n')}
}`;
