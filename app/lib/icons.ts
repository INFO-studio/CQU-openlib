/** Doc icon shortnames are `l-<lucide-kebab-name>`, e.g. `:l-book-open:`. */
export const resolveLucideIconName = (raw: string): string | null => {
  const name = raw.trim();
  if (!name.startsWith('l-')) return null;
  return name.slice(2) || null;
};
