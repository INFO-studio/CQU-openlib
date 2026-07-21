import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

/**
 * High-contrast form validation alert.
 * Avoids Uno opacity-on-CSS-var tricks that collapse to same-color-on-same-color.
 */
export const FormError = ({ children }: Props) => (
  <p
    className="rounded-md border border-[color:var(--form-error-border)] bg-[color:var(--form-error-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--form-error-fg)]"
    role="alert"
  >
    {children}
  </p>
);
