/**
 * 按照正则表达式分割文本，保留匹配的部分
 * @param text 要分割的文本
 * @param pattern 正则表达式模式
 * @returns 分割后的字符串数组，包括匹配和未匹配的部分
 */
export const splitByPattern = (text: string, pattern: RegExp): string[] => {
  const regExp = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`,
  );
  const matches = Array.from(text.matchAll(regExp));

  const { parts, lastEnd } = matches.reduce(
    (acc, match) => ({
      parts: [
        ...acc.parts,
        ...(match.index > acc.lastEnd
          ? [text.substring(acc.lastEnd, match.index)]
          : []),
        match[0],
      ],
      lastEnd: match.index + match[0].length,
    }),
    { parts: [] as string[], lastEnd: 0 },
  );

  return [
    ...parts,
    ...(lastEnd < text.length ? [text.substring(lastEnd)] : []),
  ].filter(Boolean);
};
