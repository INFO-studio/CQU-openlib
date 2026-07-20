import { RefreshCw } from 'lucide-react';
import { Button } from '~/components/ui/button';

type Props = {
  message?: string | null;
  onRetry: () => void;
  compact?: boolean;
};

const NavLoadError = ({ message, onRetry, compact = false }: Props) => {
  return (
    <div
      className={
        compact
          ? 'flex flex-col items-start gap-2 px-1 py-3'
          : 'flex flex-col items-start gap-3 rounded-md border border-line bg-mist/50 px-3 py-4'
      }
      role="alert"
    >
      <div>
        <p className="text-sm font-medium text-ink">目录加载失败</p>
        {message ? (
          <p className="mt-0.5 text-[0.75rem] text-muted">{message}</p>
        ) : null}
      </div>
      <Button
        variant="soft"
        onClick={onRetry}
        className="gap-1.5 text-[0.8125rem]"
      >
        <RefreshCw size={14} className="text-icon" />
        重试
      </Button>
    </div>
  );
};
export default NavLoadError;
