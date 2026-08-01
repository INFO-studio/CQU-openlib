import { describe, expect, it } from 'vite-plus/test';
import {
  collectFormErrors,
  type FormItemInput,
  firstErrorKey,
  numberFormItems,
  question,
  requireChoice,
  requireText,
  section,
} from '~/lib/formItems';
import { MAX_UPLOAD_BYTES, requireFile } from '~/lib/formSubmit';

const q = (key: string, validate?: () => string | null) =>
  question({ key, label: key, children: null, validate });

const indexOf = (items: FormItemInput[], key: string) => {
  const found = numberFormItems(items).find((item) => item.key === key);
  return found && found.kind === 'question' ? found.index : null;
};

describe('numberFormItems', () => {
  it('numbers questions in list order, padded to two digits', () => {
    const numbered = numberFormItems([q('a'), q('b'), q('c')]);
    expect(
      numbered.map((i) => (i.kind === 'question' ? i.index : null)),
    ).toEqual(['01', '02', '03']);
  });

  it('closes the sequence up when a question is hidden', () => {
    const shown = false;
    const items: FormItemInput[] = [q('a'), shown && q('hidden'), q('c')];
    expect(indexOf(items, 'a')).toBe('01');
    expect(indexOf(items, 'c')).toBe('02');
  });

  it('does not spend a number on section headings', () => {
    const items: FormItemInput[] = [q('a'), section('group', '教材 2'), q('b')];
    expect(indexOf(items, 'b')).toBe('02');
    expect(numberFormItems(items)).toHaveLength(3);
  });

  it('keeps counting past nine without extra padding', () => {
    const items = Array.from({ length: 12 }, (_, i) => q(`q${i}`));
    expect(indexOf(items, 'q8')).toBe('09');
    expect(indexOf(items, 'q9')).toBe('10');
    expect(indexOf(items, 'q11')).toBe('12');
  });
});

describe('collectFormErrors', () => {
  it('reports every failure at once, keyed by question', () => {
    const items = [q('a'), q('b', () => '缺 b'), q('c', () => '缺 c')];
    expect(collectFormErrors(items)).toEqual({ b: '缺 b', c: '缺 c' });
  });

  it('is empty when every question passes', () => {
    expect(collectFormErrors([q('a', () => null), q('b')])).toEqual({});
  });

  it('ignores questions that are not rendered', () => {
    const shown = false;
    const items: FormItemInput[] = [shown && q('hidden', () => '缺'), q('b')];
    expect(collectFormErrors(items)).toEqual({});
  });
});

describe('firstErrorKey', () => {
  it('points at the earliest failure in visual order', () => {
    const items = [q('a'), q('b', () => '缺 b'), q('c', () => '缺 c')];
    expect(firstErrorKey(items, collectFormErrors(items))).toBe('b');
  });

  it('returns null on a valid form', () => {
    const items = [q('a'), q('b')];
    expect(firstErrorKey(items, collectFormErrors(items))).toBeNull();
  });
});

describe('field validators', () => {
  it('treats whitespace-only text as blank', () => {
    expect(requireText('   ', '请填写')()).toBe('请填写');
    expect(requireText(' x ', '请填写')()).toBeNull();
  });

  it('rejects an unselected choice', () => {
    expect(requireChoice('', '请选择')()).toBe('请选择');
    expect(requireChoice('yes', '请选择')()).toBeNull();
  });

  it('rejects a missing file before checking its size', () => {
    expect(requireFile(null, '请选择文件')()).toBe('请选择文件');
  });

  it('rejects a file over the shared upload cap', () => {
    const big = new File(['x'], 'big.pdf');
    Object.defineProperty(big, 'size', { value: MAX_UPLOAD_BYTES + 1 });
    expect(requireFile(big, '请选择文件')()).toBe('「big.pdf」超过 50MB 上限');
  });

  it('accepts a file at exactly the cap', () => {
    const edge = new File(['x'], 'edge.pdf');
    Object.defineProperty(edge, 'size', { value: MAX_UPLOAD_BYTES });
    expect(requireFile(edge, '请选择文件')()).toBeNull();
  });
});
