import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '~/lib/cn';

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
    <div className="group relative my-[0.6rem]">
      <button
        type="button"
        className={cn(
          'absolute top-[0.35rem] right-[0.35rem] z-1 inline-flex h-7 w-7 items-center justify-center rounded-[0.3rem] border border-line bg-panel text-icon shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-[opacity,color,background,border-color] duration-150',
          'hover:border-primary-soft hover:bg-mist hover:text-ink',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
          'opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0',
          '[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100',
          '[@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100',
          copied &&
            'text-[var(--admonition-success)] opacity-100! [@media(hover:hover)_and_(pointer:fine)]:opacity-100!',
        )}
        aria-label={copied ? '已复制' : '复制代码'}
        onClick={onCopy}
      >
        {copied ? (
          <Check size={14} strokeWidth={2} />
        ) : (
          <Copy size={14} strokeWidth={2} />
        )}
      </button>
      <pre
        data-language={lang || undefined}
        className="m-0 overflow-x-auto rounded-[0.35rem] bg-code-bg py-[0.65rem] pr-[2.4rem] pl-[0.8rem] font-mono text-[0.84rem] leading-[1.5]"
      >
        <code
          className={
            lang
              ? `language-${lang} bg-transparent p-0 text-[length:inherit]`
              : 'bg-transparent p-0 text-[length:inherit]'
          }
        >
          {value}
        </code>
      </pre>
    </div>
  );
};

export default CodeBlock;
