import { pinyin } from 'pinyin-pro';
import { parseDocument } from 'yaml';
import type { AlphaLetter } from '../app/lib/courseAlpha';
import { significantTitle } from '../app/lib/titleOrder';

/**
 * Build-time only. Pulls in the full pinyin dictionary (~48 KB brotli), so it
 * must never be reachable from the client graph — the letter is baked into
 * nav-index.json instead.
 *
 * 课程页可以写 `letter: Z`。只认 A–Z 和 `#`（`#` 要加引号，否则 YAML 当成注释）。
 * 别的值忽略，回退到标题拼音。
 */
const frontmatterPattern = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

const explicitLetter = (markdown: string): AlphaLetter | undefined => {
  const block = markdown.match(frontmatterPattern)?.[1];
  if (!block) return undefined;
  const parsed = parseDocument(block);
  if (parsed.errors.length) return undefined;
  const metadata = parsed.toJS({ maxAliasCount: 0 });
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    Array.isArray(metadata)
  ) {
    return undefined;
  }
  const value = Reflect.get(metadata, 'letter');
  if (typeof value !== 'string') return undefined;
  const token = value.trim();
  if (token === '#') return '#';
  return /^[A-Z]$/.test(token) ? (token as AlphaLetter) : undefined;
};

export const letterOfTitle = (title: string): AlphaLetter => {
  const cleaned = significantTitle(title);
  const ch = cleaned[0];
  if (!ch) return '#';
  if (/[A-Za-z]/.test(ch)) return ch.toUpperCase() as AlphaLetter;
  if (/[0-9]/.test(ch)) return '#';
  const first = pinyin(ch, { pattern: 'first', toneType: 'none' });
  const letter = (first[0] ?? '').toUpperCase();
  if (/[A-Z]/.test(letter)) return letter as AlphaLetter;
  return '#';
};

export const courseLetter = (title: string, markdown = ''): AlphaLetter =>
  explicitLetter(markdown) ?? letterOfTitle(title);
