import { match } from 'ts-pattern';
import type { Mn } from '~/types/mdast';

export const mapTextNodes = (
  nodes: Mn[] | undefined,
  parse: (value: string) => Mn[],
): Mn[] =>
  (nodes ?? []).flatMap((node): Mn[] =>
    match(node)
      .with({ type: 'text' }, ({ value }) => parse(value))
      .with({ type: 'tabs' }, { type: 'collapseGroup' }, (group) => [
        {
          ...group,
          items: group.items.map((item) => ({
            ...item,
            title: mapTextNodes(item.title, parse),
            children: mapTextNodes(item.children, parse),
          })),
        },
      ])
      .otherwise((parent) => [
        {
          ...parent,
          ...('children' in parent && parent.children
            ? { children: mapTextNodes(parent.children, parse) }
            : {}),
          ...('title' in parent && Array.isArray(parent.title)
            ? { title: mapTextNodes(parent.title, parse) }
            : {}),
        } as Mn,
      ]),
  );
