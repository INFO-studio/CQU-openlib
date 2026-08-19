import { X } from 'lucide-react';
import { CollapseGroup } from '~/components/ui/collapse-group';
import { MapCategoryIcon } from '../markerIcons';
import { navigationLinksFor } from '../navigation';
import type { MapItem, MapItemComment } from '../type';

const MapItemComments = ({
  comments,
}: {
  comments: readonly MapItemComment[];
}) => (
  <CollapseGroup
    size="compact"
    className="mt-2 mb-0"
    items={[
      {
        key: 'comments',
        title: `评论（${comments.length}）`,
        children: (
          <ul
            aria-label="评论列表"
            className="m-0 max-h-32 list-none space-y-2 overflow-y-auto p-0 pr-1 [scrollbar-color:var(--c-rule)_transparent] [scrollbar-width:thin]"
          >
            {comments.map((comment, index) => (
              <li
                key={`${comment.author ?? 'anonymous'}-${index}`}
                className="border-b border-line pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-ink">
                  <span>
                    <span className="text-muted">@</span>
                    {comment.author ?? '匿名'}
                  </span>
                  {comment.rate !== undefined ? (
                    <span className="shrink-0 text-muted">
                      <span>{comment.rate}</span>
                      <span className="text-muted">/10</span>
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 mb-0 text-xs leading-relaxed text-muted">
                  {comment.detail}
                </p>
              </li>
            ))}
          </ul>
        ),
      },
    ]}
  />
);

const MapItemDetails = ({
  item,
  onClose,
}: {
  item: MapItem;
  onClose: () => void;
}) => {
  const navigationLinks = navigationLinksFor(item);
  return (
    <section className="absolute right-3 bottom-3 left-3 z-10 rounded-md border border-line bg-panel/95 p-3 shadow-2xl backdrop-blur md:right-auto md:bottom-5 md:left-5 md:w-[28rem] md:p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary bg-panel text-icon-strong">
          <MapCategoryIcon category={item.category} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="m-0 font-display text-lg font-semibold leading-tight">
            {item.name}
          </h2>
          {item.desc ? (
            <p className="mt-1 mb-0 text-xs leading-relaxed text-muted">
              {item.desc}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="grid h-7 w-7 shrink-0 place-items-center text-icon-strong"
          aria-label="关闭地点详情"
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
      {item.comment?.length ? (
        <MapItemComments key={item.id} comments={item.comment} />
      ) : null}
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {navigationLinks.map((link) => (
          <a
            key={link.id}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 items-center justify-center rounded-md border border-line bg-paper px-1 text-xs font-medium text-ink no-underline hover:border-primary hover:text-primary"
          >
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
};

export default MapItemDetails;
