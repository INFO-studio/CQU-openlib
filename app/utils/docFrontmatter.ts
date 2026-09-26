import { match, P } from 'ts-pattern';
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
  return (quote === '"' || quote === "'") && value.endsWith(quote)
    ? value.slice(1, -1)
    : value;
};

const parseField = (line: string): DocFrontmatter => {
  if (!line.trim() || /^\s/.test(line)) return {};
  const colon = line.indexOf(':');
  if (colon <= 0) return {};
  const key = line.slice(0, colon).trim();
  const raw = line.slice(colon + 1).trim();
  const value = unquote(raw);
  return match({ key, raw, value })
    .with({ key: 'title', raw: 'null' }, () => ({ title: null }))
    .with({ value: '' }, () => ({}))
    .with(
      { key: 'updated', value: P.when((text) => datePattern.test(text)) },
      ({ value: updated }) => ({ updated }),
    )
    .with({ key: 'description' }, ({ value: description }) => ({ description }))
    .with({ key: 'title' }, ({ value: title }) => ({ title }))
    .with(
      { key: 'placeholder', value: P.when(isPlaceholderKey) },
      ({ value: placeholder }) => ({ placeholder }),
    )
    .otherwise(() => ({}));
};

// A full YAML parser costs 29 KB brotli in the browser; search metadata stays build-only.
export const parseDocFrontmatterYaml = (source: string): DocFrontmatter =>
  Object.fromEntries(
    source.split('\n').flatMap((line) => Object.entries(parseField(line))),
  );

export const frontmatterFromAst = (root: MnRoot): DocFrontmatter => {
  const yamlNode = (root.children ?? []).find(
    (node: Mn): node is Mn & { type: 'yaml'; value: string } =>
      node.type === 'yaml',
  );
  return yamlNode ? parseDocFrontmatterYaml(yamlNode.value) : {};
};
