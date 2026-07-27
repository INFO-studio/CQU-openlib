import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

  return (
    <button
      type="button"
      className={copied ? 'admin-card__copy is-done' : 'admin-card__copy'}
      onClick={() => void onCopy()}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {failed ? '复制失败' : copied ? '已复制' : '复制 JSON'}
    </button>
  );
};
