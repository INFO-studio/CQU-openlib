import type { Preprocess } from '~/utils/preprocess/index';

/**
 * MkDocs/Material often embeds <figure> / <center> HTML.
 * CommonMark HTML blocks (type 6) run until a blank line, so a multi-line
 * <figure> swallows the inner `![...](...)` and it never becomes an image
 * node. Convert known patterns to markdown and isolate leftover HTML.
 */
const FIGURE_OPEN = /^\s*<figure\b[^>]*>/i;
const FIGURE_CLOSE = /<\/figure>/i;
const CENTER_IMG =
  /^\s*<center>\s*<img\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/center>\s*$/i;

const extractMdImage = (block: string): string | null => {
  const md = block.match(/!\[([^\]]*)\]\(([^)\s]+)\)(\{[^}]+\})?/);
  if (md) return `![${md[1]}](${md[2]})${md[3] ?? ''}`;
  const img = block.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
  if (img) {
    const alt = block.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '';
    return `![${alt}](${img[1]})`;
  }
  return null;
};

const extractFigcaption = (block: string): string | null => {
  const m = block.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
  if (!m) return null;
  const text = m[1].replace(/<[^>]+>/g, '').trim();
  return text || null;
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Centered muted caption — keeps figcaption semantics without a real <figure>. */
const figcaptionMarkdown = (indent: string, caption: string): string =>
  `${indent}<p class="docs-figcaption">${escapeHtml(caption)}</p>`;

const preprocessHtmlBlocks: Preprocess = (lines) => {
  const out: string[] = [];

  const pushIsolated = (line: string) => {
    if (out.length && out[out.length - 1] !== '') out.push('');
    out.push(line);
    out.push('');
  };

  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const indent = cur.match(/^\s*/)?.[0] ?? '';

    if (FIGURE_OPEN.test(cur)) {
      let block = cur;
      if (!FIGURE_CLOSE.test(cur)) {
        while (i + 1 < lines.length) {
          i += 1;
          block += `\n${lines[i]}`;
          if (FIGURE_CLOSE.test(lines[i])) break;
        }
      }
      const image = extractMdImage(block);
      const caption = extractFigcaption(block);
      if (image) {
        pushIsolated(`${indent}${image}`);
        if (caption) pushIsolated(figcaptionMarkdown(indent, caption));
      } else {
        pushIsolated(block.trim());
      }
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
