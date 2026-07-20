import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vite-plus/test';
import remarkDisableIndentedCode from '~/utils/remark/remarkDisableIndentedCode';

describe('remarkDisableIndentedCode', () => {
  it('parses 4-space indented list as list, not code', () => {
    const md = 'Title\n\n    * item one\n';
    const withDisable = unified()
      .use(remarkDisableIndentedCode)
      .use(remarkParse)
      .parse(md);
    const types = JSON.stringify(withDisable);
    expect(types).toContain('"type":"list"');
    expect(types).not.toContain('"type":"code"');
  });
});
