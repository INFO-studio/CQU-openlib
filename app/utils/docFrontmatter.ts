import type { Mn, MnRoot } from '~/types/mdast';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DocFrontmatter = {
  /** Last edited date, `YYYY-MM-DD`. */
  updated?: string;
  description?: string;
};

const unquote = (value: string): string => {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value;
};

/**
 * Minimal reader for the frontmatter dialect this repo actually uses: top-level
 * `key: value` with bare or quoted scalars. Indented lines belong to nested
 * blocks (only MkDocs leftovers like `search:`), which nobody consumes, so they
 * are skipped rather than parsed. Shipping a general YAML parser to the browser
 * for this cost 29 KB brotli.
 */
export const parseDocFrontmatterYaml = (source: string): DocFrontmatter => {
  const out: DocFrontmatter = {};
  for (const line of source.split('\n')) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const value = unquote(line.slice(colon + 1).trim());
    if (!value) continue;
    if (key === 'updated' && DATE_RE.test(value)) out.updated = value;
    else if (key === 'description') out.description = value;
  }
  return out;
};

export const frontmatterFromAst = (root: MnRoot): DocFrontmatter => {
  const yamlNode = (root.children ?? []).find(
    (n: Mn): n is Mn & { type: 'yaml'; value: string } => n.type === 'yaml',
  );
  if (!yamlNode) return {};
  return parseDocFrontmatterYaml(yamlNode.value);
};
