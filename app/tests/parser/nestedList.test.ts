import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { Mn, MnList, MnListItem } from '~/types/mdast';
import preprocess from '~/utils/preprocess';
import { remarkDisableIndentedCode, removePosition } from '~/utils/remark';

const toAst = async (md: string): Promise<Mn> => {
  const processor = unified()
    .use(remarkDisableIndentedCode)
    .use(remarkParse)
    .use(remarkGfm);
  return removePosition(
    (await processor.run(processor.parse(preprocess(md)))) as Mn,
  );
};

describe('nested lists', () => {
  it('keeps 2-level nesting in the AST', async () => {
    const ast = await toAst(`* a
    * b
        * c
`);
    const rootList = (
      ast as {
        children?: Mn[];
      }
    ).children?.find((n): n is MnList => n.type === 'list');
    expect(rootList).toBeTruthy();
    if (!rootList) return;

    expect(rootList.children).toHaveLength(1);
    const firstItem = rootList.children[0] as MnListItem;
    const nested = firstItem.children.find(
      (n): n is MnList => n.type === 'list',
    );
    expect(nested).toBeTruthy();
    if (!nested) return;

    expect(nested.children).toHaveLength(1);
    const deepItem = nested.children[0] as MnListItem;
    const deep = deepItem.children.find((n): n is MnList => n.type === 'list');
    expect(deep).toBeTruthy();
  });
});
