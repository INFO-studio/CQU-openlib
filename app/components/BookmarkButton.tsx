import { BookmarkMinus, BookmarkPlus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { useBookmarkStore } from '~/stores/bookmarkStore';

type Props = {
  path: string;
  title: string;
};

const BookmarkButton = ({ path, title }: Props) => {
  const { isBookmarked, toggle } = useBookmarkStore();
  const saved = isBookmarked(path);

  return (
    <Button
      variant="ghost"
      aria-pressed={saved}
      onClick={() => {
        toggle({ path, title, savedAt: Date.now() });
      }}
    >
      {saved ? (
        <BookmarkMinus size={14} className="text-icon" />
      ) : (
        <BookmarkPlus size={14} className="text-icon" />
      )}
      {saved ? '取消收藏' : '收藏本页'}
    </Button>
  );
};
export default BookmarkButton;
