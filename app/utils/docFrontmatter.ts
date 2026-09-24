import type { Mn, MnRoot } from '~/types/mdast';
import { isPlaceholderKey, type PlaceholderKey } from '~/utils/placeholderMap';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export type DocFrontmatter = {
  updated?: string;
  description?: string;
  title?: string | null;
  placeholder?: PlaceholderKey;
};

const unquote = (value: string): string => {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return value.slice(1, -1);
  }
  return value;
};

// Search configuration is build-only; a full YAML parser costs 29 KB brotli in the browser.
export const parseDocFrontmatterYaml = (source: string): DocFrontmatter => {
  const out: DocFrontmatter = {};
  for (const line of source.split('\n')) {
    if (!line.trim() || /^\s/.test(line)) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const rawValue = line.slice(colon + 1).trim();
    if (key === 'title' && rawValue === 'null') {
      out.title = null;
      continue;
    }
    const value = unquote(rawValue);
    if (!value) continue;
    if (key === 'updated' && datePattern.test(value)) out.updated = value;
    else if (key === 'description') out.description = value;
    else if (key === 'title') out.title = value;
    else if (key === 'placeholder' && isPlaceholderKey(value)) {
      out.placeholder = value;
    }
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
