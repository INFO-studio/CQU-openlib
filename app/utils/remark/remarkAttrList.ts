import type {
  Mn,
  MnImage,
  MnLink,
  MnRoot,
  MnTabs,
  MnText,
} from '~/types/mdast';

type AttrTarget = MnLink | MnImage;

/** MkDocs / Python-Markdown attribute list: `{.class}`, `{:download="a.png"}`. */
const ATTR_LIST_RE = /^\{([.:#][^}]*)\}/;

type ParsedAttrs = {
  className?: string;
  id?: string;
  download?: string | true;
};

const parseAttrBody = (raw: string): ParsedAttrs => {
  let body = raw.trim();
  if (body.startsWith(':')) body = body.slice(1).trim();

  const out: ParsedAttrs = {};
  const classes: string[] = [];
  const tokenRe =
    /([.#][\w-]+)|([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'{}]+))|([\w-]+)/g;

  for (const match of body.matchAll(tokenRe)) {
    const [, punct, key, dq, sq, bare, flag] = match;
    if (punct) {
      if (punct.startsWith('.')) classes.push(punct.slice(1));
      else if (punct.startsWith('#')) out.id = punct.slice(1);
      continue;
    }
    if (key) {
      const value = dq ?? sq ?? bare ?? '';
      if (key === 'download') out.download = value === '' ? true : value;
      else if (key === 'class')
        classes.push(...value.split(/\s+/).filter(Boolean));
      else if (key === 'id') out.id = value;
      continue;
    }
    if (flag === 'download') out.download = true;
  }

  if (classes.length) out.className = classes.join(' ');
  return out;
};

const applyAttrs = (target: AttrTarget, attrs: ParsedAttrs) => {
  if (attrs.className) {
    target.className = target.className
      ? `${target.className} ${attrs.className}`
      : attrs.className;
  }
  if (attrs.download !== undefined && target.type === 'link') {
    target.download = attrs.download;
  }
};

const isText = (n: Mn): n is MnText => n.type === 'text';
const isAttrTarget = (n: Mn): n is AttrTarget =>
  n.type === 'link' || n.type === 'image';

const consumeAttrLists = (children: Mn[]): Mn[] => {
  const out: Mn[] = [];

  for (const node of children) {
    if (!isText(node)) {
      out.push(node);
      continue;
    }

    let value = node.value;
    while (true) {
      const prev = out[out.length - 1];
      if (!prev || !isAttrTarget(prev)) break;
      const match = value.match(ATTR_LIST_RE);
      if (!match) break;
      applyAttrs(prev, parseAttrBody(match[1] ?? ''));
      value = value.slice(match[0].length);
    }

    if (value.length) out.push({ type: 'text', value });
  }

  return out;
};

const walk = (nodes?: Mn[]): Mn[] =>
  (nodes ?? []).map((node) => {
    if (node.type === 'tabs') {
      const tabs = node as MnTabs;
      for (const item of tabs.items) {
        item.title = consumeAttrLists(walk(item.title));
        item.children = consumeAttrLists(walk(item.children));
      }
      return node;
    }

    if (!('children' in node) || !node.children) return node;
    return {
      ...node,
      children: consumeAttrLists(walk(node.children as Mn[])),
    } as Mn;
  });

const remarkAttrList = () => (tree: MnRoot) => {
  tree.children = walk(tree.children ?? []);
};

export default remarkAttrList;
