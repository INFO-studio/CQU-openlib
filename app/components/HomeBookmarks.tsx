import DocLink from '~/components/DocLink';
import { Button } from '~/components/ui/button';
import { useBookmarkStore } from '~/stores/bookmarkStore';

/** Homepage bookmarks card — mount via `<HomeBookmarks />` in markdown. */
const HomeBookmarks = () => {
  const { items, clear } = useBookmarkStore();

  return (
    <div className="admonition abstract docs-bookmarks">
      <p className="admonition-title">
        <span>您的收藏页</span>
        {items.length > 0 ? (
          <Button
            variant="ghost"
            className="docs-bookmarks__clear"
            onClick={clear}
          >
            清空收藏
          </Button>
        ) : null}
      </p>
      <div className="admonition-content">
        {items.length === 0 ? (
          <p className="text-center">您还没有收藏任何页面 _:(´□`」 ∠):_</p>
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
