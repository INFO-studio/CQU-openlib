import { Fragment } from 'react';
import type { MnKbd } from '~/types/mdast';

const parserKbd = (mn: MnKbd) => (
  <span className="docs-keys">
    {mn.keys.map((key, i) => (
      <Fragment key={`${key.name}-${i}`}>
        {i > 0 ? <span className="docs-keys__sep">+</span> : null}
        <kbd className={`docs-kbd key-${key.name}`}>{key.label}</kbd>
      </Fragment>
    ))}
  </span>
);

export default parserKbd;
