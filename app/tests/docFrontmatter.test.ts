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

  it('strips surrounding quotes', () => {
    expect(parseDocFrontmatterYaml('updated: "2026-07-21"\n')).toEqual({
      updated: '2026-07-21',
    });
    expect(parseDocFrontmatterYaml("description: 'hi'\n")).toEqual({
      description: 'hi',
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

  it('skips nested blocks', () => {
    expect(
      parseDocFrontmatterYaml(
        'search:\n  exclude: true\nhide:\n  - feedback\nupdated: 2026-07-22\n',
      ),
    ).toEqual({ updated: '2026-07-22' });
  });

  it('keeps colons inside a value', () => {
    expect(parseDocFrontmatterYaml('description: a: b\n')).toEqual({
      description: 'a: b',
    });
  });

  it('tolerates trailing whitespace', () => {
    expect(parseDocFrontmatterYaml('updated: 2026-07-22   \n')).toEqual({
      updated: '2026-07-22',
    });
  });

  it('returns empty object for empty or malformed input', () => {
    expect(parseDocFrontmatterYaml('')).toEqual({});
    expect(parseDocFrontmatterYaml('\n\n')).toEqual({});
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
