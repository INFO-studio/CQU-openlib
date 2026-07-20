type ClassValue = string | false | null | undefined;
export const cn = (...parts: ClassValue[]): string => {
  return parts.filter(Boolean).join(' ');
};
