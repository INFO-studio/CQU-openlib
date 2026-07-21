import { useNavigate } from '@tanstack/react-router';
import { Button } from '~/components/ui/button';

/** Desktop-only; sits in DocsShell left rail (sticky). Mobile uses browser back. */
export const FormBackButton = () => {
  const navigate = useNavigate();

  const onBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: '/' });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      // Top-align with FormShell h1 (same line box start; no extra height hacks).
      className="h-[1.75rem] gap-1.5 px-2 py-0 leading-tight sm:h-[2rem]"
      onClick={onBack}
    >
      <span aria-hidden="true" className="text-[1.05em] leading-none">
        ←
      </span>
      返回
    </Button>
  );
};
