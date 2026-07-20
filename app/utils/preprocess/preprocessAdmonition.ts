import { ADMONITION_END, ADMONITION_START } from '~/consts/placeholders';
import type { Preprocess } from '~/utils/preprocess/index';

const isAdmonitionHead = (line: string) =>
  /^!!!\s+\S+(\s+".*")?\s*$/.test(line);

/**
 * Fence admonition blocks and un-indent Material's 4-space body.
 * Must NOT run a global indent stripper — that flattens nested lists.
 */
const preprocessAdmonition: Preprocess = (lines) => {
  const out: string[] = [];
  let inAdmonition = false;

  const openHead = (line: string) => {
    // Blank line after the head so remark does not soft-break the body into the
    // same paragraph (Material often omits it: `!!! x "t"` then indented body).
    out.push(ADMONITION_START, line, '');
    inAdmonition = true;
  };

  for (const cur of lines) {
    if (!inAdmonition) {
      if (isAdmonitionHead(cur)) openHead(cur);
      else out.push(cur);
      continue;
    }

    if (cur.trim() === '') {
      out.push(cur);
      continue;
    }

    if (/^ {4}/.test(cur)) {
      // Keep deeper indent so nested lists inside admonitions still nest.
      out.push(cur.slice(4));
      continue;
    }

    // Close current block, then re-check — next line may be another !!! head
    // (title-only admonitions are common: quote then info with no body indent).
    out.push(ADMONITION_END);
    inAdmonition = false;
    if (isAdmonitionHead(cur)) openHead(cur);
    else out.push(cur);
  }

  if (inAdmonition) out.push(ADMONITION_END);
  return out;
};

export default preprocessAdmonition;
