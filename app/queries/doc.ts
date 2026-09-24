import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '~/queries/keys';
import type { MnRoot } from '~/types/mdast';
import { frontmatterFromAst } from '~/utils/docFrontmatter';
import { fetchDocMarkdown } from '~/utils/fetchDocMarkdown';
import { placeholderMap } from '~/utils/placeholderMap';
import preprocess from '~/utils/preprocess';
import { removePosition } from '~/utils/remark';

export type DocProcessor = {
  parse: (file: string) => unknown;
  run: (tree: unknown) => Promise<unknown> | unknown;
};
export type LoadedDoc = {
  ast: MnRoot;
  baseDir: string;
};
export const loadDocAst = async (
  page: string,
  processor: DocProcessor,
): Promise<LoadedDoc | null> => {
  const value = await fetchDocMarkdown(page);
  if (value == null) return null;
  const parsed = processor.parse(preprocess(value.markdown));
  const ast = (await processor.run(parsed)) as MnRoot;
  const placeholder = frontmatterFromAst(ast).placeholder;
  if (placeholder) {
    const template = (await processor.run(
      processor.parse(preprocess(placeholderMap[placeholder])),
    )) as MnRoot;
    ast.children = [...(ast.children ?? []), ...(template.children ?? [])];
  }
  return { ast: removePosition(ast) as MnRoot, baseDir: value.baseDir };
};
export const docAstQueryOptions = (page: string, processor: DocProcessor) => {
  return queryOptions({
    queryKey: queryKeys.doc(page),
    queryFn: () => loadDocAst(page, processor),
    // Re-parsing costs up to 65 ms, so retain ASTs for back/forward navigation.
    gcTime: 1800000,
  });
};
