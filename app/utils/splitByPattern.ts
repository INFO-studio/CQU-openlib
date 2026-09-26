export const splitByPattern = (text: string, pattern: RegExp): string[] => {
  const expression = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
  );
  const matches = [...text.matchAll(expression)];
  const parts = matches.flatMap((match, index) => {
    const previous = matches[index - 1];
    const start = previous ? previous.index + previous[0].length : 0;
    return [text.slice(start, match.index), match[0]];
  });
  const last = matches.at(-1);
  return [...parts, text.slice(last ? last.index + last[0].length : 0)].filter(
    Boolean,
  );
};
