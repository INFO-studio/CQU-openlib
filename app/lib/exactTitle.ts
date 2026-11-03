const mix = (hash: number, code: number, prime: number) =>
  Math.imul(hash ^ code, prime);

export const exactTitleToken = (title: string): string => {
  const codes = [...title.trim()].map((char) => char.codePointAt(0) ?? 0);
  const fnv = codes.reduce(
    (hash, code) => mix(hash, code, 16777619),
    2166136261,
  );
  const djb = codes.reduce((hash, code) => mix(hash, code, 33), 5381);
  return `qxt${(fnv >>> 0).toString(16).padStart(8, '0')}${(djb >>> 0).toString(16).padStart(8, '0')}`;
};
