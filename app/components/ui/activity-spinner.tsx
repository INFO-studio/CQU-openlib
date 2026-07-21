import type { CSSProperties } from 'react';
import { cn } from '~/lib/cn';

type Props = {
  /** Outer box size in px. */
  size?: number;
  className?: string;
  /** Accessible label. */
  label?: string;
};

const BLADES = 8;

/**
 * iOS-style activity indicator: 8 fixed blades, opacity cascade only.
 * Color via `currentColor`.
 */
export const ActivitySpinner = ({
  size = 28,
  className,
  label = '加载中',
}: Props) => (
  <span
    className={cn('activity-spinner', className)}
    style={{ width: size, height: size }}
    role="status"
    aria-label={label}
  >
    {Array.from({ length: BLADES }, (_, i) => (
      <span
        key={i}
        className="activity-spinner__arm"
        style={
          {
            '--blade': i,
            transform: `rotate(${i * 45}deg)`,
          } as CSSProperties
        }
        aria-hidden="true"
      />
    ))}
    <style>{`
      .activity-spinner {
        position: relative;
        display: inline-block;
        color: inherit;
      }
      .activity-spinner__arm {
        position: absolute;
        inset: 0;
      }
      .activity-spinner__arm::before {
        content: '';
        position: absolute;
        top: 6%;
        left: 50%;
        width: 11.5%;
        height: 26%;
        margin-left: -5.75%;
        border-radius: 999px;
        background: currentColor;
        animation: activity-blade 0.8s linear infinite;
        animation-delay: calc(var(--blade) * -0.1s);
      }
      @keyframes activity-blade {
        0% { opacity: 1; }
        100% { opacity: 0.12; }
      }
      @media (prefers-reduced-motion: reduce) {
        .activity-spinner__arm::before {
          animation: none;
          opacity: calc(0.18 + var(--blade) * 0.08);
        }
      }
    `}</style>
  </span>
);
