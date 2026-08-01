import { createGenerator } from 'unocss';
import { describe, expect, it } from 'vite-plus/test';
import config from '../../../uno.config';

/**
 * A theme entry under the wrong key fails silently: the class is simply never
 * generated and the element renders unstyled. That has bitten us three times
 * (`bg-primary-faint`, `grid-cols-*` under the plural key, `h-header` where
 * only spacing was set). So: take every name the theme defines, build the
 * utility it promises, and check something came out.
 */

const theme = config.theme as Record<string, Record<string, unknown>>;

const kebab = (s: string) =>
  s.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);

const names = (key: string) => Object.keys(theme[key] ?? {});

/** Theme keys uno actually reads. A typo here means the whole group is dead. */
const GROUPS: Array<[key: string, prefix: string]> = [
  ['colors', 'text-'],
  ['spacing', 'gap-'],
  ['height', 'h-'],
  ['minHeight', 'min-h-'],
  ['gridTemplateColumn', 'grid-cols-'],
  ['boxShadow', 'shadow-'],
];

describe('theme utilities', () => {
  it.each(GROUPS)('%s is a key uno reads', (key) => {
    expect(names(key).length).toBeGreaterThan(0);
  });

  it('generates a class for every theme entry', async () => {
    const uno = await createGenerator(config);
    const dead: string[] = [];

    for (const [key, prefix] of GROUPS) {
      for (const name of names(key)) {
        const cls = `${prefix}${kebab(name)}`;
        const { css } = await uno.generate(cls, { preflights: false });
        if (!css.includes('{')) dead.push(cls);
      }
    }

    expect(dead).toEqual([]);
  });

  it('generates the shortcuts', async () => {
    const uno = await createGenerator(config);
    const dead: string[] = [];

    for (const name of Object.keys(config.shortcuts ?? {})) {
      const { css } = await uno.generate(name, { preflights: false });
      if (!css.includes('{')) dead.push(name);
    }

    expect(dead).toEqual([]);
  });
});
