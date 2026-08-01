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
    className="rounded-md border border-error-line bg-error-soft px-3 py-2.5 text-sm font-medium text-error"
    role="alert"
  >
    {children}
  </p>
);
