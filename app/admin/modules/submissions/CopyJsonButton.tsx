import { Check, Copy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { statusTone } from '~/admin/lib/status';
import { cn } from '~/lib/cn';

const COPIED_MS = 1600;

type Props = {
  /** Serialised as-is, so pass the whole submission rather than a projection. */
  value: unknown;
};

export const CopyJsonButton = ({ value }: Props) => {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onCopy = async () => {
    const reset = (ok: boolean) => {
      setCopied(ok);
      setFailed(!ok);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        setFailed(false);
      }, COPIED_MS);
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      reset(true);
    } catch {
      // Denied permission or an insecure context — say so instead of looking
      // like the copy worked.
      reset(false);
    }
  };

  const label = failed ? '复制失败' : copied ? '已复制 JSON' : '复制 JSON';

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => void onCopy()}
      style={copied ? { color: statusTone('completed') } : undefined}
      className={cn(
        'relative z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors',
        failed
          ? 'text-error'
          : copied
            ? ''
            : 'text-icon hover:bg-mist hover:text-icon-strong',
      )}
    >
      {copied ? (
        <Check size={14} />
      ) : failed ? (
        <X size={14} />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
};
