import type { MnFootnoteDefinition, MnFootnoteReference } from '~/types/mdast';
import parser from '~/utils/parser/index';

export const parserFootnoteReference = (mn: MnFootnoteReference) => {
  const id = mn.identifier;
  const label = mn.label ?? id;
  return (
    <sup className="docs-footnote-ref">
      <a href={`#fn-${id}`} id={`fnref-${id}`}>
        {label}
      </a>
    </sup>
  );
};

export const parserFootnoteDefinition = (mn: MnFootnoteDefinition) => {
  const id = mn.identifier;
  const label = mn.label ?? id;
  return (
    <aside className="docs-footnote-def" id={`fn-${id}`}>
      <span className="docs-footnote-def__label">{label}.</span>
      <div className="docs-footnote-def__body">{mn.children.map(parser)}</div>
      <a className="docs-footnote-def__back" href={`#fnref-${id}`}>
        ↩
      </a>
    </aside>
  );
};
