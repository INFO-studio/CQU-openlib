import { Link } from '@tanstack/react-router';
import { FormShell } from '~/components/forms/FormShell';
import { Button } from '~/components/ui/button';

type Props = {
  title: string;
  lede: string;
  onAgain: () => void;
};

export const FormDone = ({ title, lede, onAgain }: Props) => (
  <FormShell title={title} lede={lede}>
    <div className="rounded-lg border border-line bg-panel px-5 py-6">
      <p className="font-display text-xl font-semibold text-ink">已收到</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        感谢你的贡献。内容已送达维护者，我们会尽快处理。
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" variant="soft" onClick={onAgain}>
          再写一份
        </Button>
        <Link
          to="/"
          className="inline-flex items-center rounded px-2 py-1 text-sm text-muted no-underline hover:bg-mist hover:text-ink"
        >
          回首页
        </Link>
      </div>
    </div>
  </FormShell>
);
