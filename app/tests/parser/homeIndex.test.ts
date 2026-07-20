import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import type { Mn } from '~/types/mdast';
import preprocess from '~/utils/preprocess';
import {
  remarkAdmonition,
  remarkContentTabs,
  remarkDisableIndentedCode,
  remarkFormatting,
  remarkIcon,
  removePosition,
} from '~/utils/remark';

describe('homepage index.md', () => {
  it('keeps sections after the grid', async () => {
    const raw = readFileSync(resolve('public/doc/index.md'), 'utf8');
    const pre = preprocess(raw);
    const processor = unified()
      .use(remarkDisableIndentedCode)
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkGfm)
      .use(remarkContentTabs)
      .use(remarkAdmonition)
      .use(remarkFormatting)
      .use(remarkIcon);
    const ast = removePosition(
      (await processor.run(processor.parse(pre))) as Mn,
    );
    const json = JSON.stringify(ast);
    expect(json).toContain('快来加群捏');
    expect(json).toContain('简介');
    expect(json).toContain('友情链接');

    const failure = (ast as { children?: Mn[] }).children?.find(
      (n) => n.type === 'admonition' && n.admonitionType === 'failure',
    ) as
      | {
          type: 'admonition';
          title?: Mn[];
          children?: Mn[];
        }
      | undefined;
    expect(failure).toBeTruthy();
    expect(JSON.stringify(failure!.title)).toContain('提醒');
    expect(JSON.stringify(failure!.title)).not.toContain(
      'cqu-openlib@outlook.com',
    );
    expect(JSON.stringify(failure!.children)).toContain(
      'cqu-openlib@outlook.com',
    );
  });
});
