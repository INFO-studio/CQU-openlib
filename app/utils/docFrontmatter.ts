import { parse as parseYaml } from 'yaml';
import type { Mn, MnRoot } from '~/types/mdast';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DocFrontmatter = {
  /** Last edited date, `YYYY-MM-DD`. */
  updated?: string;
  description?: string;
  hide?: string[];
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatUtcDate = (d: Date): string => {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

const asUpdated = (value: unknown): string | undefined => {
  if (typeof value === 'string' && DATE_RE.test(value)) return value;
  // YAML 1.1 / custom schemas may coerce bare dates to Date.
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatUtcDate(value);
  }
  return undefined;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const asStringList = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === 'string');
  return list.length ? list : undefined;
};

/** Parse a YAML frontmatter body (without `---` fences). */
export const parseDocFrontmatterYaml = (source: string): DocFrontmatter => {
  try {
    const data = parseYaml(source);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const raw = data as Record<string, unknown>;
    const out: DocFrontmatter = {};
    const updated = asUpdated(raw.updated);
    if (updated) out.updated = updated;
    const description = asString(raw.description);
    if (description) out.description = description;
    const hide = asStringList(raw.hide);
    if (hide) out.hide = hide;
    return out;
  } catch {
    return {};
  }
};

export const frontmatterFromAst = (root: MnRoot): DocFrontmatter => {
  const yamlNode = (root.children ?? []).find(
    (n: Mn): n is Mn & { type: 'yaml'; value: string } => n.type === 'yaml',
  );
  if (!yamlNode) return {};
  return parseDocFrontmatterYaml(yamlNode.value);
};
