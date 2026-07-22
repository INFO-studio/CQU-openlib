import type { MnFootnoteDefinition, MnFootnoteReference } from '~/types/mdast';
import parser from '~/utils/parser/index';

export const parserFootnoteReference = (mn: MnFootnoteReference) => {
  const id = mn.identifier;
  const label = mn.label ?? id;
  return (
    <sup>
      <a
        href={`#fn-${id}`}
        id={`fnref-${id}`}
        className="font-semibold text-primary no-underline"
      >
        {label}
      </a>
    </sup>
  );
};

export const parserFootnoteDefinition = (mn: MnFootnoteDefinition) => {
  const id = mn.identifier;
  const label = mn.label ?? id;
  return (
    <aside
      className="my-2 flex items-start gap-[0.4rem] border-t border-line pt-2 text-sm text-muted"
      id={`fn-${id}`}
    >
      <span>{label}.</span>
      <div className="min-w-0 flex-1">{mn.children.map(parser)}</div>
      <a href={`#fnref-${id}`} className="text-primary no-underline">
        ↩
      </a>
    </aside>
  );
};
