/** Material admonition kinds (`!!! note "…"` / `??? note "…"`). */
export const ADMONITION_TYPES = [
  'note',
  'abstract',
  'info',
  'tip',
  'success',
  'question',
  'warning',
  'failure',
  'danger',
  'bug',
  'example',
  'quote',
] as const;

export type AdmonitionType = (typeof ADMONITION_TYPES)[number];

/** `!!!` = always open; `???` = collapsed; `???+` = collapsible, initially open. */
export type AdmonitionCollapse = 'closed' | 'open';

/**
 * Material head: `!!! tip "t"` | `??? tip "t"` | `???+ tip "t"`.
 * Group 1 = marker, 2 = type, 3 = title.
 */
export const ADMONITION_PATTERN = /^(!!!|\?\?\?\+?)\s+(\w+)\s+"([^"]*)"/;

export const isValidAdmonitionType = (type: string): type is AdmonitionType => {
  return (ADMONITION_TYPES as readonly string[]).includes(type);
};

export const collapseFromMarker = (
  marker: string,
): AdmonitionCollapse | undefined => {
  if (marker === '???') return 'closed';
  if (marker === '???+') return 'open';
  return undefined;
};
