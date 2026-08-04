import { Dialog } from '@base-ui/react/dialog';
import {
  Download,
  Maximize2,
  RotateCcw,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Button } from '~/components/ui/button';
import { cn } from '~/lib/cn';

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;
const PAN_EDGE_ALLOWANCE = 24;
const TOOLBAR_CLEARANCE = 72;

type Props = {
  src: string;
  alt: string;
  children: ReactNode;
  className?: string;
};

type TouchPoint = {
  x: number;
  y: number;
};

type Pinch = {
  distance: number;
  scale: number;
};

type Position = {
  x: number;
  y: number;
};

type Pan = Position & {
  pointerId: number;
  startX: number;
  startY: number;
};

type WebKitGestureEvent = Event & {
  clientX: number;
  clientY: number;
  scale: number;
};

const clampScale = (scale: number) =>
  Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const distanceBetween = ([a, b]: TouchPoint[]) =>
  Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0));

const midpointBetween = ([a, b]: TouchPoint[]): TouchPoint | undefined =>
  a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : undefined;

const constrainPosition = (
  next: Position,
  scale: number,
  viewer: HTMLDivElement | null,
  image: HTMLImageElement | null,
): Position => {
  if (!viewer || !image || scale <= 1) return { x: 0, y: 0 };
  const overflowX = Math.max(
    0,
    (image.offsetWidth * scale - viewer.clientWidth) / 2,
  );
  const overflowY = Math.max(
    0,
    (image.offsetHeight * scale - viewer.clientHeight) / 2,
  );
  return {
    x: Math.min(
      overflowX + PAN_EDGE_ALLOWANCE,
      Math.max(-overflowX - PAN_EDGE_ALLOWANCE, next.x),
    ),
    y: Math.min(
      overflowY + PAN_EDGE_ALLOWANCE,
      Math.max(-overflowY - TOOLBAR_CLEARANCE, next.y),
    ),
  };
};

const positionAfterScale = (
  current: Position,
  previousScale: number,
  nextScale: number,
  anchor: TouchPoint | undefined,
  viewer: HTMLDivElement | null,
  image: HTMLImageElement | null,
) => {
  if (!anchor || !viewer || previousScale === nextScale) {
    return constrainPosition(current, nextScale, viewer, image);
  }
  const bounds = viewer.getBoundingClientRect();
  const focalPoint = {
    x: anchor.x - bounds.left - bounds.width / 2,
    y: anchor.y - bounds.top - bounds.height / 2,
  };
  const ratio = nextScale / previousScale;
  return constrainPosition(
    {
      x: focalPoint.x - (focalPoint.x - current.x) * ratio,
      y: focalPoint.y - (focalPoint.y - current.y) * ratio,
    },
    nextScale,
    viewer,
    image,
  );
};

export const rotationFromSteps = (steps: number) => {
  const turn = ((steps % 4) + 4) % 4;
  return turn === 3 ? -90 : turn * 90;
};

const downloadName = (src: string) => {
  const name = src.split(/[?#]/, 1)[0]?.split('/').at(-1);
  if (!name) return 'image';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

export const ImagePreview = ({ src, alt, children, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [rotationSteps, setRotationSteps] = useState(0);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const scaleRef = useRef(1);
  const touchesRef = useRef(new Map<number, TouchPoint>());
  const pinchRef = useRef<Pinch | null>(null);
  const panRef = useRef<Pan | null>(null);

  const resetSize = () => {
    scaleRef.current = 1;
    setScale(1);
    setPosition({ x: 0, y: 0 });
    panRef.current = null;
  };

  const resetAll = () => {
    resetSize();
    setRotationSteps(0);
    touchesRef.current.clear();
    pinchRef.current = null;
  };

  const changeScale = (next: number, anchor?: TouchPoint) => {
    const previous = scaleRef.current;
    const clamped = clampScale(next);
    scaleRef.current = clamped;
    setScale(clamped);
    setPosition((current) =>
      positionAfterScale(
        current,
        previous,
        clamped,
        anchor,
        viewerRef.current,
        imageRef.current,
      ),
    );
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== imageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === 'touch') {
      touchesRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (touchesRef.current.size === 2) {
        pinchRef.current = {
          distance: distanceBetween([...touchesRef.current.values()]),
          scale: scaleRef.current,
        };
        panRef.current = null;
        return;
      }
    }
    if (scaleRef.current > 1) {
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        ...position,
      };
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (touchesRef.current.has(event.pointerId)) {
      touchesRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const pinch = pinchRef.current;
      if (pinch && touchesRef.current.size === 2 && pinch.distance > 0) {
        const points = [...touchesRef.current.values()];
        const distance = distanceBetween(points);
        changeScale(
          pinch.scale * (distance / pinch.distance),
          midpointBetween(points),
        );
        return;
      }
    }

    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setPosition(
      constrainPosition(
        {
          x: pan.x + event.clientX - pan.startX,
          y: pan.y + event.clientY - pan.startY,
        },
        scaleRef.current,
        viewerRef.current,
        imageRef.current,
      ),
    );
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    touchesRef.current.delete(event.pointerId);
    if (touchesRef.current.size < 2) pinchRef.current = null;
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  };

  useEffect(() => {
    const popup = popupRef.current;
    if (!open || !popup) return;
    let gestureStartScale = scaleRef.current;
    const applyGestureScale = (next: number, anchor?: TouchPoint) => {
      const previous = scaleRef.current;
      const clamped = clampScale(next);
      scaleRef.current = clamped;
      setScale(clamped);
      setPosition((current) =>
        positionAfterScale(
          current,
          previous,
          clamped,
          anchor,
          viewerRef.current,
          imageRef.current,
        ),
      );
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStartScale = scaleRef.current;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as WebKitGestureEvent;
      applyGestureScale(gestureStartScale * gesture.scale, {
        x: gesture.clientX,
        y: gesture.clientY,
      });
    };
    const onTrackpadWheel = (event: globalThis.WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      applyGestureScale(scaleRef.current * Math.exp(-event.deltaY * 0.01), {
        x: event.clientX,
        y: event.clientY,
      });
    };
    const options = { passive: false } as const;
    document.addEventListener('wheel', onTrackpadWheel, {
      ...options,
      capture: true,
    });
    popup.addEventListener('gesturestart', onGestureStart, options);
    popup.addEventListener('gesturechange', onGestureChange, options);
    return () => {
      document.removeEventListener('wheel', onTrackpadWheel, true);
      popup.removeEventListener('gesturestart', onGestureStart);
      popup.removeEventListener('gesturechange', onGestureChange);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={cn(
          'group/image-preview relative block w-full cursor-zoom-in overflow-hidden rounded-md text-left focus-visible:outline-offset-2',
          className,
        )}
        aria-label={`全屏查看：${alt || '图片'}`}
        onClick={() => setOpen(true)}
      >
        {children}
        <span className="pointer-events-none absolute right-2 bottom-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-elev text-icon shadow-sm opacity-0 transition-opacity group-hover/image-preview:opacity-100 group-focus-visible/image-preview:opacity-100">
          <Maximize2 size={16} aria-hidden />
        </span>
      </button>

      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetAll();
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-60 bg-backdrop" />
          <Dialog.Popup
            ref={popupRef}
            className="fixed inset-0 z-61 flex touch-none flex-col outline-none"
            aria-label={alt || '图片预览'}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <Dialog.Title className="sr-only">{alt || '图片预览'}</Dialog.Title>
            <div className="absolute bottom-3 left-1/2 z-2 flex -translate-x-1/2 items-center gap-1 rounded-md border border-line bg-elev p-1 shadow-lg">
              <Button
                variant="icon"
                aria-label="缩小"
                disabled={scale <= MIN_SCALE}
                onClick={() => changeScale(scale - SCALE_STEP)}
              >
                <ZoomOut size={17} />
              </Button>
              <Button
                variant="ghost"
                className="min-w-14 font-mono text-xs"
                aria-label="恢复默认大小"
                onClick={resetSize}
              >
                {Math.round(scale * 100)}%
              </Button>
              <Button
                variant="icon"
                aria-label="放大"
                disabled={scale >= MAX_SCALE}
                onClick={() => changeScale(scale + SCALE_STEP)}
              >
                <ZoomIn size={17} />
              </Button>
              <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden />
              <Button
                variant="icon"
                aria-label="向左旋转"
                onClick={() => setRotationSteps((value) => value - 1)}
              >
                <RotateCcw size={16} />
              </Button>
              <Button
                variant="icon"
                aria-label="向右旋转"
                onClick={() => setRotationSteps((value) => value + 1)}
              >
                <RotateCw size={16} />
              </Button>
              <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden />
              <a
                href={src}
                download={downloadName(src)}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-icon transition-colors hover:bg-mist hover:text-icon-strong"
                aria-label="下载原图"
              >
                <Download size={17} />
              </a>
              <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden />
              <Dialog.Close
                className="inline-flex h-8 w-8 items-center justify-center rounded text-icon transition-colors hover:bg-mist hover:text-icon-strong"
                aria-label="关闭"
              >
                <X size={18} />
              </Dialog.Close>
            </div>

            <div
              ref={viewerRef}
              className="relative flex min-h-0 flex-1 select-none items-center justify-center overflow-hidden"
            >
              <Dialog.Close
                className="absolute inset-0 cursor-zoom-out"
                aria-label="关闭图片预览"
              />
              <img
                ref={imageRef}
                src={src}
                alt={alt}
                draggable={false}
                className={cn(
                  'relative z-1 max-h-full max-w-full object-contain shadow-2xl',
                  scale > 1
                    ? 'cursor-grab active:cursor-grabbing'
                    : 'cursor-default',
                )}
                style={{
                  transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale}) rotate(${rotationFromSteps(rotationSteps)}deg)`,
                }}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
};
