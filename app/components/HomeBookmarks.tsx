import Admonition from '~/components/Admonition';
import DocLink from '~/components/DocLink';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/cn';
import { useBookmarkStore } from '~/stores/bookmarkStore';

/** Homepage bookmarks card — mount via `<HomeBookmarks />` in markdown. */
const HomeBookmarks = () => {
  const { items, clear } = useBookmarkStore();
  const empty = items.length === 0;

  return (
    <Admonition
      type="abstract"
      className="flex flex-1 flex-col"
      title={<span>您的收藏页</span>}
      titleAside={
        !empty ? (
          <Button
            variant="ghost"
            className="absolute top-1/2 right-[0.85rem] h-auto min-h-0 -translate-y-1/2 bg-transparent p-0 text-xs font-medium leading-[1.45] hover:bg-transparent"
            onClick={clear}
          >
            清空收藏
          </Button>
        ) : null
      }
    >
      <div
        className={cn(
          'flex flex-1 flex-col',
          empty &&
            'min-h-[5.5rem] items-center justify-center [&>p]:m-0 [&>p]:text-center',
        )}
      >
        {empty ? (
          <p>您还没有收藏任何页面 _:(´□`」 ∠):_</p>
        ) : (
          <ul className="my-1 list-disc pl-5 [&>li]:my-[0.15rem] [&>li::marker]:text-muted">
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
    </Admonition>
  );
};
export default HomeBookmarks;
