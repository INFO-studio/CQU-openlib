import { pinyin } from 'pinyin-pro';
import type { AlphaLetter } from '../app/lib/courseAlpha';

/**
 * Build-time only. Pulls in the full pinyin dictionary (~48 KB brotli), so it
 * must never be reachable from the client graph — the letter is baked into
 * nav-index.json instead.
 */
const significantTitle = (title: string): string => {
  return title.replace(/^[\s"'“”‘’《》〈〉【】（）()[\]「」]+/u, '').trim();
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
