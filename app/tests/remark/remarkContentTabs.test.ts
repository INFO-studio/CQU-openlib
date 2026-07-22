import { describe, expect, it } from 'vite-plus/test';
import { TAB_ITEM, TABS_END, TABS_START } from '~/consts/placeholders';
import type { Mn, MnRoot } from '~/types/mdast';
import remarkContentTabs, {
  dropSerializedPrefix,
  serializeInline,
  serializedLen,
  sliceSerialized,
  splitTabMarkerParagraph,
} from '~/utils/remark/remarkContentTabs';

describe('serializedLen', () => {
  it('counts text, backticks around inlineCode, and softbreak as 1', () => {
    expect(serializedLen({ type: 'text', value: 'ab' })).toBe(2);
    expect(serializedLen({ type: 'inlineCode', value: 'x' })).toBe(3);
    expect(serializedLen({ type: 'break' })).toBe(1);
  });

  it('returns null for nodes that cannot be re-serialized inline', () => {
    expect(serializedLen({ type: 'html', value: '<!-- x -->' })).toBeNull();
    expect(
      serializedLen({
        type: 'link',
        title: null,
        url: 'https://example.com',
        children: [{ type: 'text', value: 'a' }],
      }),
    ).toBeNull();
  });
});

describe('serializeInline', () => {
  it('round-trips text + inlineCode + softbreak', () => {
    expect(
      serializeInline([
        { type: 'text', value: '=== ":l-book:' },
        { type: 'inlineCode', value: 'MATH10821' },
        { type: 'text', value: '"' },
      ]),
    ).toBe('=== ":l-book:`MATH10821`"');
  });

  it('stops before unsupported inline nodes', () => {
    expect(
      serializeInline([
        { type: 'text', value: '=== "A"' },
        {
          type: 'link',
          title: null,
          url: 'https://example.com',
          children: [{ type: 'text', value: 'x' }],
        },
        { type: 'text', value: 'tail' },
      ]),
    ).toBe('=== "A"');
  });

  it('treats softbreak as newline', () => {
    expect(
      serializeInline([
        { type: 'text', value: '=== "A"' },
        { type: 'break' },
        { type: 'text', value: 'body' },
      ]),
    ).toBe('=== "A"\nbody');
  });
});

describe('sliceSerialized / dropSerializedPrefix', () => {
  const nodes: Mn[] = [
    { type: 'text', value: '=== "' },
    { type: 'text', value: ':l-book:' },
    { type: 'inlineCode', value: 'CODE' },
    { type: 'text', value: '"' },
    { type: 'break' },
    { type: 'text', value: '  rest' },
  ];

  it('slices a title that spans text and inlineCode', () => {
    // `=== "` = 5 chars, title = `:l-book:`CODE``
    expect(sliceSerialized(nodes, 5, 5 + ':l-book:`CODE`'.length)).toEqual([
      { type: 'text', value: ':l-book:' },
      { type: 'inlineCode', value: 'CODE' },
    ]);
  });

  it('returns empty for empty ranges', () => {
    expect(sliceSerialized(nodes, 3, 3)).toEqual([]);
    expect(sliceSerialized(nodes, 5, 2)).toEqual([]);
  });

  it('partially overlapping inlineCode falls back to text slice', () => {
    // Take only the opening backtick of inlineCode
    const start = '=== ":l-book:'.length;
    expect(sliceSerialized(nodes, start, start + 1)).toEqual([
      { type: 'text', value: '`' },
    ]);
  });

  it('drops a full marker prefix and keeps the glued body', () => {
    const flat = serializeInline(nodes);
    const markerEnd = flat.indexOf('"') + 1; // first closing quote after open
    // More precisely: full marker `=== ":l-book:`CODE`"`
    const fullMarker = '=== ":l-book:`CODE`"';
    expect(flat.startsWith(fullMarker)).toBe(true);
    expect(dropSerializedPrefix(nodes, fullMarker.length)).toEqual([
      { type: 'break' },
      { type: 'text', value: '  rest' },
    ]);
  });

  it('offset 0 returns the same children reference path', () => {
    expect(dropSerializedPrefix(nodes, 0)).toBe(nodes);
  });

  it('offset past the end yields empty', () => {
    expect(dropSerializedPrefix(nodes, 10_000)).toEqual([]);
  });

  it('splits mid-text when dropping prefix', () => {
    expect(
      dropSerializedPrefix([{ type: 'text', value: 'abcdef' }], 2),
    ).toEqual([{ type: 'text', value: 'cdef' }]);
  });
});

describe('splitTabMarkerParagraph', () => {
  it('falls back to Tab on empty / non-marker input', () => {
    expect(splitTabMarkerParagraph([])).toEqual({
      title: [{ type: 'text', value: 'Tab' }],
      body: null,
    });
    expect(
      splitTabMarkerParagraph([{ type: 'text', value: 'not a tab' }]),
    ).toEqual({
      title: [{ type: 'text', value: 'Tab' }],
      body: null,
    });
    expect(
      splitTabMarkerParagraph([{ type: 'text', value: '=== Title' }]),
    ).toEqual({
      title: [{ type: 'text', value: 'Tab' }],
      body: null,
    });
  });

  it('parses plain double-quoted and single-quoted titles', () => {
    expect(
      splitTabMarkerParagraph([{ type: 'text', value: '=== "简洁版"' }]),
    ).toEqual({
      title: [{ type: 'text', value: '简洁版' }],
      body: null,
    });
    expect(
      splitTabMarkerParagraph([{ type: 'text', value: "=== '简洁版'" }]),
    ).toEqual({
      title: [{ type: 'text', value: '简洁版' }],
      body: null,
    });
  });

  it('accepts empty titles and trailing whitespace after the closer', () => {
    expect(
      splitTabMarkerParagraph([{ type: 'text', value: '=== ""' }]),
    ).toEqual({
      title: [{ type: 'text', value: '' }],
      body: null,
    });
    expect(
      splitTabMarkerParagraph([{ type: 'text', value: '=== "A"   ' }]),
    ).toEqual({
      title: [{ type: 'text', value: 'A' }],
      body: null,
    });
  });

  it('rejects mismatched quotes', () => {
    expect(
      splitTabMarkerParagraph([{ type: 'text', value: `=== "A'` }]),
    ).toEqual({
      title: [{ type: 'text', value: 'Tab' }],
      body: null,
    });
  });

  it('keeps icon+backtick titles that mdast splits (高等数学 regression)', () => {
    const { title, body } = splitTabMarkerParagraph([
      { type: 'text', value: '=== ":l-book:' },
      { type: 'inlineCode', value: 'MATH10821' },
      { type: 'text', value: '"' },
    ]);
    expect(title).toEqual([
      { type: 'text', value: ':l-book:' },
      { type: 'inlineCode', value: 'MATH10821' },
    ]);
    expect(body).toBeNull();
  });

  it('keeps multiple backtick spans inside one title', () => {
    const { title } = splitTabMarkerParagraph([
      { type: 'text', value: '=== "' },
      { type: 'inlineCode', value: 'a' },
      { type: 'text', value: ' + ' },
      { type: 'inlineCode', value: 'b' },
      { type: 'text', value: '"' },
    ]);
    expect(title).toEqual([
      { type: 'inlineCode', value: 'a' },
      { type: 'text', value: ' + ' },
      { type: 'inlineCode', value: 'b' },
    ]);
  });

  it('splits glued body after softbreak without polluting the title', () => {
    const { title, body } = splitTabMarkerParagraph([
      { type: 'text', value: '=== "简洁版"' },
      { type: 'break' },
      { type: 'text', value: '  下载后打开' },
    ]);
    expect(title).toEqual([{ type: 'text', value: '简洁版' }]);
    expect(body).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: '下载后打开' }],
    });
  });

  it('splits glued body that starts on the same text node', () => {
    const { title, body } = splitTabMarkerParagraph([
      { type: 'text', value: '=== "A" body-here' },
    ]);
    expect(title).toEqual([{ type: 'text', value: 'A' }]);
    expect(body).toEqual({
      type: 'paragraph',
      children: [{ type: 'text', value: 'body-here' }],
    });
  });

  it('does not mutate the source children array', () => {
    const children: Mn[] = [
      { type: 'text', value: '=== ":l-book:' },
      { type: 'inlineCode', value: 'X' },
      { type: 'text', value: '"' },
    ];
    const snapshot = structuredClone(children);
    splitTabMarkerParagraph(children);
    expect(children).toEqual(snapshot);
  });
});

describe('remarkContentTabs', () => {
  it('builds tabs from sentinels and resolves icon+code titles', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        { type: 'html', value: TABS_START },
        { type: 'html', value: TAB_ITEM },
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: '=== ":l-book:' },
            { type: 'inlineCode', value: 'MATH10821' },
            { type: 'text', value: '"' },
          ],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'body-a' }],
        },
        { type: 'html', value: TAB_ITEM },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '=== "普通"' }],
        },
        { type: 'html', value: TABS_END },
      ],
    };

    remarkContentTabs()(tree);

    const children = tree.children ?? [];
    expect(children).toHaveLength(1);
    const tabs = children[0];
    expect(tabs).toMatchObject({ type: 'tabs' });
    if (tabs?.type !== 'tabs') throw new Error('expected tabs');
    expect(tabs.items).toHaveLength(2);
    expect(tabs.items[0]!.title).toEqual([
      { type: 'text', value: ':l-book:' },
      { type: 'inlineCode', value: 'MATH10821' },
    ]);
    expect(tabs.items[0]!.title.some((n) => n.type === 'text' && n.value === 'Tab')).toBe(
      false,
    );
    expect(tabs.items[1]!.title).toEqual([{ type: 'text', value: '普通' }]);
  });

  it('nests a tabs group inside the current item', () => {
    const tree: MnRoot = {
      type: 'root',
      children: [
        { type: 'html', value: TABS_START },
        { type: 'html', value: TAB_ITEM },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '=== "外"' }],
        },
        { type: 'html', value: TABS_START },
        { type: 'html', value: TAB_ITEM },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '=== "内"' }],
        },
        { type: 'html', value: TABS_END },
        { type: 'html', value: TABS_END },
      ],
    };

    remarkContentTabs()(tree);
    const outer = (tree.children ?? [])[0];
    expect(outer?.type).toBe('tabs');
    if (outer?.type !== 'tabs') throw new Error('expected tabs');
    expect(outer.items[0]!.title).toEqual([{ type: 'text', value: '外' }]);
    const nested = outer.items[0]!.children.find((n) => n.type === 'tabs');
    expect(nested?.type).toBe('tabs');
    if (nested?.type !== 'tabs') throw new Error('expected nested tabs');
    expect(nested.items[0]!.title).toEqual([{ type: 'text', value: '内' }]);
  });
});
