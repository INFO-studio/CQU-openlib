import type { Preprocess } from '~/utils/preprocess/index';

/**
 * MkDocs/Material often embeds one-line <figure> / <center> HTML.
 * CommonMark HTML blocks (type 6) run until a blank line, so a figure
 * without a trailing blank line swallows subsequent `<!-- TABS_* -->`
 * markers. Convert known patterns to markdown and isolate leftover HTML.
 */
const FIGURE = /^\s*<figure\b[^>]*>[\s\S]*?<\/figure>\s*$/i;
const CENTER_IMG =
  /^\s*<center>\s*<img\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/center>\s*$/i;

const extractMdImage = (line: string): string | null => {
  const md = line.match(/!\[([^\]]*)\]\(([^)\s]+)\)/);
  if (md) return `![${md[1]}](${md[2]})`;
  const img = line.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  if (img) {
    const alt = line.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '';
    return `![${alt}](${img[1]})`;
  }
  return null;
};

const preprocessHtmlBlocks: Preprocess = (lines) => {
  const out: string[] = [];

  const pushIsolated = (line: string) => {
    if (out.length && out[out.length - 1] !== '') out.push('');
    out.push(line);
    out.push('');
  };

  for (const cur of lines) {
    const indent = cur.match(/^\s*/)?.[0] ?? '';

    if (FIGURE.test(cur)) {
      const image = extractMdImage(cur);
      pushIsolated(image ? `${indent}${image}` : cur.trim());
      continue;
    }

    const center = cur.match(CENTER_IMG);
    if (center) {
      const alt = cur.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '';
      pushIsolated(`${indent}![${alt}](${center[1]})`);
      continue;
    }

    // Any other single-line HTML element: keep but isolate so it cannot
    // swallow following tab/admonition markers.
    if (/^\s*<[a-zA-Z][^>]*>[\s\S]*<\/[a-zA-Z][^>]*>\s*$/.test(cur)) {
      pushIsolated(cur.trim());
      continue;
    }

    out.push(cur);
  }

  return out;
};

export default preprocessHtmlBlocks;
