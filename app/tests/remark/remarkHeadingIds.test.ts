import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import { createDocProcessor } from '~/utils/docProcessor';
import { assignHeadingIds } from '~/utils/remark/remarkHeadingIds';
import { extractToc } from '~/utils/toc';

const astOf = (markdown: string): MnRoot => {
  const processor = createDocProcessor();
  return processor.runSync(processor.parse(markdown)) as unknown as MnRoot;
};

describe('remarkHeadingIds', () => {
  it('keeps the first slug and suffixes repeated headings in document order', () => {
    const ast = astOf('## 工作内容\n\n正文\n\n## 工作内容\n\n## 工作内容\n');
    const headings = (ast.children ?? []).filter(
      (node) => node.type === 'heading',
    );
    expect(headings.map((heading) => heading.id)).toEqual([
      '工作内容',
      '工作内容_1',
      '工作内容_2',
    ]);
    expect(extractToc(ast).map((item) => item.id)).toEqual([
      '工作内容',
      '工作内容_1',
      '工作内容_2',
    ]);
  });

  it('does not collide with an authored heading that already looks suffixed', () => {
    const ast = astOf('## 标题\n\n## 标题_1\n\n## 标题\n');
    const headings = (ast.children ?? []).filter(
      (node) => node.type === 'heading',
    );
    expect(headings.map((heading) => heading.id)).toEqual([
      '标题',
      '标题_1',
      '标题_2',
    ]);
  });

  it('does not mutate shared nodes and resets allocation for each document', () => {
    const heading = {
      type: 'heading',
      depth: 2,
      children: [{ type: 'text', value: '内容' }],
    } as const;
    const node = { ...heading, children: [...heading.children] };
    const source: MnRoot = {
      type: 'root',
      children: [
        node,
        { type: 'tabs', items: [{ title: [], children: [node] }] },
      ],
    };
    const original = structuredClone(source);
    const mapped = assignHeadingIds(source);
    expect(mapped).toMatchObject({
      children: [{ id: '内容' }, { items: [{ children: [{ id: '内容_1' }] }] }],
    });
    expect(source).toEqual(original);
    expect(assignHeadingIds(source)).toEqual(mapped);
    expect(assignHeadingIds(mapped)).toEqual(mapped);
  });
});
