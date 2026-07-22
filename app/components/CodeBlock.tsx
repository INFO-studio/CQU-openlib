import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
  value: string;
  lang?: string;
};

const COPIED_MS = 1600;

const CodeBlock = ({ value, lang }: Props) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className="docs-codeblock">
      <button
        type="button"
        className="docs-codeblock__copy"
        data-copied={copied ? 'true' : undefined}
        aria-label={copied ? '已复制' : '复制代码'}
        title={copied ? '已复制' : '复制'}
        onClick={onCopy}
      >
        {copied ? (
          <Check size={14} strokeWidth={2} />
        ) : (
          <Copy size={14} strokeWidth={2} />
        )}
      </button>
      <pre data-language={lang || undefined}>
        <code className={lang ? `language-${lang}` : undefined}>{value}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;
