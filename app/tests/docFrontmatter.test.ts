import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import {
  frontmatterFromAst,
  parseDocFrontmatterYaml,
} from '~/utils/docFrontmatter';

describe('parseDocFrontmatterYaml', () => {
  it('reads updated as YYYY-MM-DD string', () => {
    expect(
      parseDocFrontmatterYaml('updated: 2026-07-22\ndescription: hello\n'),
    ).toEqual({
      updated: '2026-07-22',
      description: 'hello',
    });
  });

  it('reads hide list', () => {
    expect(parseDocFrontmatterYaml('hide:\n  - feedback\n')).toEqual({
      hide: ['feedback'],
    });
  });

  it('ignores invalid updated values', () => {
    expect(
      parseDocFrontmatterYaml('updated: tomorrow\n').updated,
    ).toBeUndefined();
    expect(
      parseDocFrontmatterYaml('updated: 2026/07/22\n').updated,
    ).toBeUndefined();
  });

  it('returns empty object for invalid yaml', () => {
    expect(parseDocFrontmatterYaml(': :\n[')).toEqual({});
  });
});

describe('frontmatterFromAst', () => {
  it('extracts yaml node from root', () => {
    const root: MnRoot = {
      type: 'root',
      children: [
        { type: 'yaml', value: 'updated: "2026-07-21"\n' },
        {
          type: 'heading',
          depth: 1,
          children: [{ type: 'text', value: 'Hi' }],
        },
      ],
    };
    expect(frontmatterFromAst(root)).toEqual({ updated: '2026-07-21' });
  });

  it('returns empty when no yaml', () => {
    const root: MnRoot = {
      type: 'root',
      children: [
        {
          type: 'heading',
          depth: 1,
          children: [{ type: 'text', value: 'Hi' }],
        },
      ],
    };
    expect(frontmatterFromAst(root)).toEqual({});
  });
});
