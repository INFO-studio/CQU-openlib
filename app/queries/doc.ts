import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '~/queries/keys';
import type { Mn, MnRoot } from '~/types/mdast';
import { fetchDocMarkdown } from '~/utils/fetchDocMarkdown';
import preprocess from '~/utils/preprocess';
import { removePosition } from '~/utils/remark';
/** Minimal unified processor surface used by the doc pipeline. */
export type DocProcessor = {
  parse: (file: string) => unknown;
  run: (tree: unknown) => Promise<unknown> | unknown;
};
export const loadDocAst = async (
  page: string,
  processor: DocProcessor,
): Promise<MnRoot | null> => {
  const value = await fetchDocMarkdown(page);
  if (value == null) return null;
  const preprocessed = preprocess(value);
  const parsed = processor.parse(preprocessed);
  const next = removePosition((await processor.run(parsed)) as Mn);
  return next as MnRoot;
};
export const docAstQueryOptions = (page: string, processor: DocProcessor) => {
  return queryOptions({
    queryKey: queryKeys.doc(page),
    queryFn: () => loadDocAst(page, processor),
    staleTime: 30000,
  });
};
