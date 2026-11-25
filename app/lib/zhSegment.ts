const hanWordPattern = /^\p{Script=Han}{2,}$/u;
const hanRunPattern = /\p{Script=Han}+/gu;

export type ZhVocabulary = {
  readonly words: ReadonlySet<string>;
  readonly prefixes: ReadonlySet<string>;
  readonly maxLength: number;
};

export const createZhVocabulary = (words: Iterable<string>): ZhVocabulary => {
  const valid = Array.from(words, (word) => word.trim()).filter((word) =>
    hanWordPattern.test(word),
  );
  const wordSet = new Set(valid);
  const prefixSet = new Set(
    valid.flatMap((word) =>
      Array.from({ length: Math.max(word.length - 2, 0) }, (_, index) =>
        word.slice(0, index + 2),
      ),
    ),
  );
  const maxLength = valid.reduce((max, word) => Math.max(max, word.length), 0);
  return { words: wordSet, prefixes: prefixSet, maxLength };
};

export const parseZhVocabulary = (text: string): ZhVocabulary =>
  createZhVocabulary(text.split(/\r?\n/));

const matchLongestWord = (
  run: string,
  index: number,
  vocab: ZhVocabulary,
): string | undefined => {
  const limit = Math.min(vocab.maxLength, run.length - index);
  // Short-circuiting descending length scan picks the longest match in the dictionary.
  for (let length = limit; length >= 2; length -= 1) {
    const candidate = run.slice(index, index + length);
    if (vocab.words.has(candidate)) return candidate;
  }
  return undefined;
};

const segmentZhRun = (run: string, vocab: ZhVocabulary): string => {
  // Greedy FMM cursor and token buffer stay local to this function.
  const tokens: string[] = [];
  let index = 0;
  while (index < run.length) {
    const matched = matchLongestWord(run, index, vocab);
    if (matched) {
      tokens.push(matched);
      index += matched.length;
      continue;
    }
    const rest = run.slice(index);
    if (rest.length >= 2 && vocab.prefixes.has(rest)) {
      tokens.push(rest);
      break;
    }
    tokens.push(run[index]);
    index += 1;
  }
  return ` ${tokens.join(' ')} `;
};

export const segmentZhText = (input: string, vocab: ZhVocabulary): string => {
  if (vocab.words.size === 0) return input.trim();
  return input
    .replace(hanRunPattern, (run) => segmentZhRun(run, vocab))
    .replace(/\s+/g, ' ')
    .trim();
};
