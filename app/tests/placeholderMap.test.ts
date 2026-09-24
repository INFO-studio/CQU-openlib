import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { type DocProcessor, loadDocAst } from '~/queries/doc';
import { frontmatterFromAst } from '~/utils/docFrontmatter';
import { createDocProcessor } from '~/utils/docProcessor';
import { placeholderMap } from '~/utils/placeholderMap';

const load = async (markdown: string) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(markdown, {
          headers: { 'content-type': 'text/markdown' },
        }),
    ),
  );
  return (await loadDocAst('course/A', createDocProcessor() as DocProcessor))!
    .ast;
};

afterEach(() => vi.unstubAllGlobals());

describe('course placeholder', () => {
  it('renders the same AST as the previous template while preserving metadata', async () => {
    const old = await load(placeholderMap.course);
    const migrated = await load(
      '---\nplaceholder: course\nupdated: 2020-01-01\n---\n',
    );
    expect(migrated.children?.filter((node) => node.type !== 'yaml')).toEqual(
      old.children,
    );
    expect(frontmatterFromAst(migrated)).toEqual({
      placeholder: 'course',
      updated: '2020-01-01',
    });
  });

  it('does not discard real content when a placeholder has additional text', async () => {
    const ast = await load('---\nplaceholder: course\n---\n\n已知教材信息\n');
    expect(JSON.stringify(ast)).toContain('已知教材信息');
  });
});
