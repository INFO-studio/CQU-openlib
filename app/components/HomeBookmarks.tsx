import DocLink from '~/components/DocLink';
import { Button } from '~/components/ui/button';
import { useBookmarkStore } from '~/stores/bookmarkStore';

/** Renders as Material-style abstract admonition under 公告. */
const HomeBookmarks = () => {
  const { items, clear } = useBookmarkStore();

  return (
    <div className="admonition abstract">
      <p className="admonition-title">
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span>您的收藏页</span>
          {items.length > 0 ? (
            <Button
              className="px-1.5 py-0.5 text-[0.75rem] font-normal"
              onClick={clear}
            >
              清空
            </Button>
          ) : null}
        </span>
      </p>
      <div className="admonition-content">
        {items.length === 0 ? (
          <p>在任意文档页点击「收藏」，会出现在这里（本地存储）。</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.path}>
                <DocLink
                  path={item.path}
                  className="text-primary no-underline hover:underline"
                >
                  {item.title}
                </DocLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
export default HomeBookmarks;
