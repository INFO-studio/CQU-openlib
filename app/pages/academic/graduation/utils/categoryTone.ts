/**
 * 去向类别 needs categorical colors, which the semantic palette does not have —
 * so it borrows the admonition hues. Those already ship both light and dark
 * values as `--admonition-*`, so reading them as CSS variables keeps the page
 * theme-aware without adding a second palette.
 */
const TONE_BY_CATEGORY: Record<string, string> = {
  就业: 'tip',
  升学: 'note',
  '出国(境)留学或工作': 'example',
  选调生: 'warning',
  志愿服务西部计划: 'question',
  双特计划: 'abstract',
  三支一扶: 'info',
  村官计划: 'bug',
};

/** Unknown 类别 fall back to the neutral quote grey rather than a random hue. */
export const categoryColor = (category: string): string =>
  `var(--admonition-${TONE_BY_CATEGORY[category] ?? 'quote'})`;
