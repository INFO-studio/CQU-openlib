/** Map legacy Material icon shortnames → Lucide kebab names. */
export const MATERIAL_TO_LUCIDE: Record<string, string> = {
  account: 'user',
  'arrow-left': 'arrow-left',
  'arrow-right': 'arrow-right',
  'arrow-up-circle': 'circle-arrow-up',
  book: 'book',
  calendar: 'calendar',
  'comment-text': 'message-square-text',
  domain: 'building-2',
  'emoticon-sad-outline': 'frown',
  'file-document': 'file-text',
  'form-select': 'list-checks',
  'format-quote-open': 'quote',
  printer: 'printer',
  tag: 'tag',
};
export const resolveLucideIconName = (raw: string): string | null => {
  const name = raw.trim();
  if (!name) return null;
  if (name.startsWith('l-')) return name.slice(2) || null;
  if (name.startsWith('lucide-')) return name.slice('lucide-'.length) || null;
  if (name.startsWith('material-')) {
    const key = name.slice('material-'.length);
    return MATERIAL_TO_LUCIDE[key] ?? null;
  }
  return name;
};
export const kebabToPascalCase = (name: string): string => {
  return name
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};
