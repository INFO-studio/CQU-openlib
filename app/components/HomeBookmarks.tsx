import DocLink from '~/components/DocLink';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/cn';
import { useBookmarkStore } from '~/stores/bookmarkStore';

/** Homepage bookmarks card — mount via `<HomeBookmarks />` in markdown. */
const HomeBookmarks = () => {
  const { items, clear } = useBookmarkStore();
  const empty = items.length === 0;

  return (
    <div className="admonition abstract docs-bookmarks">
      <p className="admonition-title">
        <span>您的收藏页</span>
        {!empty ? (
          <Button
            variant="ghost"
            className="docs-bookmarks__clear"
            onClick={clear}
          >
            清空收藏
          </Button>
        ) : null}
      </p>
      <div
        className={cn(
          'admonition-content',
          empty && 'docs-bookmarks__empty',
        )}
      >
        {empty ? (
          <p>您还没有收藏任何页面 _:(´□`」 ∠):_</p>
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
