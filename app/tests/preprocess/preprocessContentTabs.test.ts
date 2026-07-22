import { describe, expect, it } from 'vite-plus/test';
import { TAB, TAB_ITEM, TABS_END, TABS_START } from '~/consts/placeholders';
import preprocessContentTabs, {
  lineIndent,
  tabHead,
} from '~/utils/preprocess/preprocessContentTabs';

describe('tabHead', () => {
  it('returns indent width for valid heads', () => {
    expect(tabHead('=== "A"')).toBe(0);
    expect(tabHead('    === "A"')).toBe(4);
    expect(tabHead('\t=== "A"')).toBe(4);
    expect(tabHead('\t\t=== "A"')).toBe(8);
  });

  it('rejects lines that are not tab heads', () => {
    expect(tabHead('===')).toBeNull();
    expect(tabHead('==="A"')).toBeNull(); // no space after ===
    expect(tabHead('==== "A"')).toBeNull();
    expect(tabHead('text === "A"')).toBeNull();
    expect(tabHead('')).toBeNull();
  });

  it('requires a non-space after ===\\s+', () => {
    expect(tabHead('===  ')).toBeNull();
    expect(tabHead('=== "x"')).toBe(0);
  });
});

describe('lineIndent', () => {
  it('counts spaces and expands tabs to 4', () => {
    expect(lineIndent('')).toBe(0);
    expect(lineIndent('hi')).toBe(0);
    expect(lineIndent('  hi')).toBe(2);
    expect(lineIndent('\thi')).toBe(4);
    expect(lineIndent(' \thi')).toBe(5);
  });
});

describe('preprocessContentTabs', () => {
  it('wraps a flat sibling tab group', () => {
    expect(
      preprocessContentTabs(['=== "A"', '    a', '=== "B"', '    b']),
    ).toEqual([
      TABS_START,
      TAB_ITEM,
      '=== "A"',
      '    a',
      TAB_ITEM,
      '=== "B"',
      '    b',
      TABS_END,
    ]);
  });

  it('opens nested groups by deeper indent and closes on leave', () => {
    expect(
      preprocessContentTabs([
        '=== "外"',
        '    === "中"',
        '        body',
        '## leave',
      ]),
    ).toEqual([
      TABS_START,
      TAB_ITEM,
      '=== "外"',
      TABS_START,
      TAB_ITEM,
      '    === "中"',
      '        body',
      TABS_END,
      TABS_END,
      '## leave',
    ]);
  });

  it('keeps blank lines inside an open group without closing', () => {
    expect(
      preprocessContentTabs(['=== "A"', '', '    body', '']),
    ).toEqual([TABS_START, TAB_ITEM, '=== "A"', '', '    body', '', TABS_END]);
  });

  it('closes open groups at EOF', () => {
    expect(preprocessContentTabs(['=== "A"', '    still open'])).toEqual([
      TABS_START,
      TAB_ITEM,
      '=== "A"',
      '    still open',
      TABS_END,
    ]);
  });

  it('passes through TAB sentinel unchanged', () => {
    expect(preprocessContentTabs([TAB, '=== "A"'])).toEqual([
      TAB,
      TABS_START,
      TAB_ITEM,
      '=== "A"',
      TABS_END,
    ]);
  });

  it('ignores non-head === lines outside a group', () => {
    expect(preprocessContentTabs(['===', 'plain'])).toEqual(['===', 'plain']);
  });

  it('preserves icon+backtick titles as raw source lines', () => {
    const line = '=== ":l-book:`MATH10821`"';
    expect(preprocessContentTabs([line, '    * x'])).toEqual([
      TABS_START,
      TAB_ITEM,
      line,
      '    * x',
      TABS_END,
    ]);
  });

  it('sibling tabs at the same indent stay in one group', () => {
    const out = preprocessContentTabs([
      '=== ":l-book:`A`"',
      '    a',
      '=== ":l-book:`B`"',
      '    b',
    ]);
    expect(out.filter((l) => l === TABS_START)).toHaveLength(1);
    expect(out.filter((l) => l === TAB_ITEM)).toHaveLength(2);
    expect(out.filter((l) => l === TABS_END)).toHaveLength(1);
  });
});
