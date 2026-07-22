import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect, useMemo } from 'react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import BookmarkButton from '~/components/BookmarkButton';
import DocsShell from '~/components/DocsShell';
import { DocSkeleton } from '~/components/Skeleton';
import { DocBaseContext } from '~/contexts/DocBaseContext';
import { useDeferredFlag } from '~/hooks/useDeferredFlag';
import { titleFromPath } from '~/lib/nav';
import { cleanPath, decodePathname } from '~/lib/paths';
import { type DocProcessor, docAstQueryOptions } from '~/queries/doc';
import type { MnRoot } from '~/types/mdast';
import parser from '~/utils/parser';
import { mapDocNodes } from '~/utils/parser/mapDocNodes';
import {
  remarkAdmonition,
  remarkAttrList,
  remarkContentTabs,
  remarkDisableIndentedCode,
  remarkFormatting,
  remarkIcon,
  remarkKeys,
} from '~/utils/remark';
import { extractToc, pageTitleFromAst } from '~/utils/toc';

const resolvePagePath = (splat: string | undefined): string => {
  return splat?.replace(/\.mdx?$/i, '') || 'index';
};

/** True when the doc already has an H1 (usually at the top). */
const hasH1Heading = (root: MnRoot): boolean => {
  return (root.children ?? []).some(
    (n) => n.type === 'heading' && n.depth === 1,
  );
};

const useDocAst = (page: string, enabled: boolean) => {
  const processor = useMemo(
    () =>
      unified()
        .use(remarkDisableIndentedCode)
        .use(remarkParse)
        .use(remarkFrontmatter)
        .use(remarkGfm)
        .use(remarkContentTabs)
        .use(remarkAdmonition)
        .use(remarkAttrList)
        .use(remarkFormatting)
        .use(remarkKeys)
        .use(remarkIcon),
    [],
  );

  return useQuery({
    ...docAstQueryOptions(page, processor as DocProcessor),
    enabled,
  });
};

type DocPageProps = {
  splat?: string;
};

const DocPage = ({ splat }: DocPageProps) => {
  const pathname = useRouterState({
    select: (s) => cleanPath(decodePathname(s.location.pathname)),
  });
  const page = resolvePagePath(splat);
  const isRawMarkdownRequest = Boolean(splat && /\.mdx?$/i.test(splat));

  type Redirect =
    | { to: '/'; params?: undefined }
    | { to: '/$'; params: { _splat: string } }
    | null;

  const redirect: Redirect = (() => {
    if (!(splat && !isRawMarkdownRequest)) return null;
    if (page === 'index') return { to: '/' };
    if (page.endsWith('/index')) {
      return {
        to: '/$',
        params: { _splat: page.slice(0, -'/index'.length) },
      };
    }
    return null;
  })();

  const shouldRedirect = Boolean(redirect);
  const {
    data: file,
    isPending,
    isSuccess,
    isError,
    error,
    refetch,
  } = useDocAst(page, !shouldRedirect);

  const toc = useMemo(() => (file ? extractToc(file.ast) : []), [file]);
  const pathTitle = useMemo(() => decodePathname(titleFromPath(page)), [page]);
  const hasH1 = useMemo(
    () => (file ? hasH1Heading(file.ast) : true),
    [file],
  );
  const title = useMemo(() => {
    if (!file) return pathTitle || 'CQU-openlib';
    if (hasH1) return pageTitleFromAst(file.ast);
    return pathTitle || 'CQU-openlib';
  }, [file, hasH1, pathTitle]);

  useEffect(() => {
    if (!shouldRedirect) document.title = `${title} · CQU-openlib`;
  }, [title, shouldRedirect]);

  const showDocSkeleton = useDeferredFlag(isPending);

  if (redirect?.to === '/') {
    return <Navigate to="/" replace />;
  }
  if (redirect?.to === '/$') {
    return <Navigate to="/$" params={redirect.params} replace />;
  }

  const body: ReactNode = (() => {
    if (isSuccess && file === null) {
      return (
        <div>
          <h1>未找到页面</h1>
          <p className="text-muted">
            没有对应的 Markdown：<code>{page}</code>
          </p>
        </div>
      );
    }
    if (isPending) {
      return showDocSkeleton ? (
        <DocSkeleton />
      ) : (
        <div className="min-h-[12rem]" aria-busy aria-label="文档加载中" />
      );
    }
    if (isError) {
      return (
        <div>
          <h1>文档加载失败</h1>
          <p className="text-muted">
            {error instanceof Error ? error.message : '请稍后重试'}
          </p>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-primary hover:underline"
            onClick={() => void refetch()}
          >
            重试
          </button>
        </div>
      );
    }
    if (!file) return <div className="text-muted">空文档</div>;

    const showBookmark = pathname !== '/';
    const nodes = file.ast.children ?? [];
    const firstH1Index = hasH1
      ? nodes.findIndex((n) => n.type === 'heading' && n.depth === 1)
      : -1;

    return (
      <DocBaseContext.Provider value={file.baseDir}>
        <article className="min-w-0 docs-prose">
          {!hasH1 ? (
            <div className="docs-title-row">
              <h1 className="m-0 mb-2 font-display text-[1.75rem] font-semibold leading-[1.25] tracking-[-0.02em]">
                {title}
              </h1>
              {showBookmark ? (
                <BookmarkButton path={pathname} title={title} />
              ) : null}
            </div>
          ) : null}
          {mapDocNodes(nodes, (node, i) => {
            if (showBookmark && i === firstH1Index) {
              return (
                <div className="docs-title-row">
                  {parser(node)}
                  <BookmarkButton path={pathname} title={title} />
                </div>
              );
            }
            return parser(node);
          })}
          <footer className="mt-8 mb-16 border-t border-line pt-3 text-[0.8125rem] text-muted">
            <p className="m-0">
              内容来自社区贡献。如有问题请通过
              <Link
                to="/form/$type"
                params={{ type: 'feedback' }}
                search={{ page: pathname }}
                className="mx-1 text-primary no-underline hover:underline"
              >
                问题反馈
              </Link>
              联系我们。
            </p>
            {pathname.startsWith('/club/') ? (
              <p className="mt-2 m-0">
                社长或管理人员可通过
                <Link
                  to="/form/$type"
                  params={{ type: 'club' }}
                  className="mx-1 text-primary no-underline hover:underline"
                >
                  社团信息表单
                </Link>
                更新本页信息。
              </p>
            ) : null}
            <p className="mt-4 m-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-left leading-relaxed">
              <span>Copyright © 2024 - 2026</span>
              <span>CQU-openlib Opensource Community</span>
              <span aria-hidden="true">·</span>
              <a
                href="https://www.gnu.org/licenses/gpl-3.0.html"
                target="_blank"
                rel="noreferrer"
                className="text-primary no-underline hover:underline"
              >
                GPL-3.0
              </a>
            </p>
          </footer>
        </article>
      </DocBaseContext.Provider>
    );
  })();

  return <DocsShell toc={toc}>{body}</DocsShell>;
};
export default DocPage;
