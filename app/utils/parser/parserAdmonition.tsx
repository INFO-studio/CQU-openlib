import type { MnAdmonition } from '~/types/mdast';
import parser from '~/utils/parser/index';

/** MkDocs Material class shape: `admonition note` + optional title/content. */
const parserAdmonition = (mn: MnAdmonition) => {
  const hasTitle = Boolean(mn.title?.length);
  const hasContent = Boolean(mn.children?.length);
  const mods = [
    mn.admonitionType,
    !hasTitle ? 'admonition--no-title' : '',
    !hasContent ? 'admonition--no-content' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`admonition ${mods}`}>
      {hasTitle ? (
        <p className="admonition-title">
          <span className="min-w-0 flex-1">{mn.title!.map(parser)}</span>
        </p>
      ) : null}
      {hasContent ? (
        <div className="admonition-content">{mn.children!.map(parser)}</div>
      ) : null}
    </div>
  );
};

export default parserAdmonition;
