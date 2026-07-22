import { Fragment } from 'react';
import type { MnKbd } from '~/types/mdast';

const parserKbd = (mn: MnKbd) => (
  <span className="inline-flex items-center gap-[0.15rem] align-[0.05em]">
    {mn.keys.map((key, i) => (
      <Fragment key={`${key.name}-${i}`}>
        {i > 0 ? (
          <span className="select-none text-[0.7rem] leading-none text-muted">
            +
          </span>
        ) : null}
        <kbd className={`docs-kbd key-${key.name}`}>{key.label}</kbd>
      </Fragment>
    ))}
  </span>
);

export default parserKbd;
