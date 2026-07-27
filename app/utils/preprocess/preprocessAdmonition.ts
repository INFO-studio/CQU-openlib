import { ADMONITION_END, ADMONITION_START } from '~/consts/placeholders';
import type { Preprocess } from '~/utils/preprocess/index';

/** Spaces only: a tab-indented head has no well-defined body column. */
const HEAD = /^( *)!!!\s+\S+(\s+".*")?\s*$/;

const leadingSpaces = (line: string): number =>
  line.length - line.trimStart().length;

/**
 * Fence admonition blocks and un-indent Material's 4-space body.
 *
 * The head may itself be indented, because Material lets an admonition sit
 * inside a list item. Body lines are then 4 columns deeper than the head, and
 * the placeholders keep the head's indent so remark parses them as siblings
 * within that list item rather than as top-level nodes.
 *
 * Must NOT run a global indent stripper — that flattens nested lists.
 */
const preprocessAdmonition: Preprocess = (lines) => {
  const out: string[] = [];
  /** Indent of the open head, or null when outside an admonition. */
  let base: number | null = null;

  const openHead = (line: string, indent: number) => {
    // Blank line after the head so remark does not soft-break the body into the
    // same paragraph (Material often omits it: `!!! x "t"` then indented body).
    out.push(`${' '.repeat(indent)}${ADMONITION_START}`, line, '');
    base = indent;
  };

  const tryOpen = (line: string): boolean => {
    const head = HEAD.exec(line);
    if (!head) return false;
    openHead(line, head[1]!.length);
    return true;
  };

  for (const cur of lines) {
    if (base === null) {
      if (!tryOpen(cur)) out.push(cur);
      continue;
    }

    if (cur.trim() === '') {
      out.push(cur);
      continue;
    }

    if (leadingSpaces(cur) >= base + 4) {
      // Strip one level only, so nested lists inside admonitions still nest.
      out.push(cur.slice(4));
      continue;
    }

    // Close current block, then re-check — next line may be another !!! head
    // (title-only admonitions are common: quote then info with no body indent).
    out.push(`${' '.repeat(base)}${ADMONITION_END}`);
    base = null;
    if (!tryOpen(cur)) out.push(cur);
  }

  if (base !== null) out.push(`${' '.repeat(base)}${ADMONITION_END}`);
  return out;
};

export default preprocessAdmonition;
