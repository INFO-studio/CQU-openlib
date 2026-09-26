import { describe, expect, it } from 'vite-plus/test';
import type { MnRoot } from '~/types/mdast';
import { createDocProcessor } from '~/utils/docProcessor';
import { extractToc } from '~/utils/toc';

const astOf = (markdown: string): MnRoot => {
  const processor = createDocProcessor();
  return processor.runSync(processor.parse(markdown)) as unknown as MnRoot;
};

describe('extractToc', () => {
  it('extracts contiguous H2-H6 headings and ignores H1', () => {
    const ast = astOf(
      ['# 页面标题', '## 二级', '#### 四级', '###### 六级'].join('\n'),
    );

    expect(extractToc(ast)).toEqual([
      { id: '二级', text: '二级', level: 2, indent: 0 },
      { id: '四级', text: '四级', level: 4, indent: 1 },
      { id: '六级', text: '六级', level: 6, indent: 2 },
    ]);
  });

  it('computes indentation from all heading depths instead of encounter order', () => {
    const ast = astOf(['##### 五级', '## 二级', '#### 四级'].join('\n'));

    expect(
      extractToc(ast).map(({ text, indent }) => ({ text, indent })),
    ).toEqual([
      { text: '五级', indent: 2 },
      { text: '二级', indent: 0 },
      { text: '四级', indent: 1 },
    ]);
  });
});
