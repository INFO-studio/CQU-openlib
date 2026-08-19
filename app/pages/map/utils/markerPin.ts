import type { AmapApi } from '../amap';
import { markerCategoryIconMarkup } from '../markerIcons';
import type { MapItem, MapItemCategory } from '../type';

export const MARKER_PIN_SIZE = 36;
export const MARKER_SCALE = {
  idle: 1,
  hover: 1.4,
  selected: 1.45,
} as const;

const markerPinMarkup = (category: MapItemCategory) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" style="display:block;filter:drop-shadow(0 1px 2px rgb(15 23 42 / .2))">
    <path d="M12 2c-3.87 0-7 3.13-7 7 0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z" fill="var(--c-panel)" stroke="var(--map-pin-outline,var(--c-icon))" stroke-width="1" stroke-linejoin="round" style="transition:stroke 160ms ease"/>
  </svg>${markerCategoryIconMarkup(category)}`;

export const applyMarkerPinState = (
  root: HTMLDivElement,
  selected: boolean,
) => {
  const body = root.querySelector<HTMLDivElement>('[data-map-pin-body]');
  if (!body) return;
  body.dataset.selected = selected ? 'true' : 'false';
  body.style.setProperty(
    '--map-pin-outline',
    selected ? 'var(--c-primary)' : 'var(--c-icon)',
  );
  body.style.transform = `scale(${
    selected ? MARKER_SCALE.selected : MARKER_SCALE.idle
  })`;
};

export const applyMarkerPinHover = (root: HTMLDivElement, hovered: boolean) => {
  const body = root.querySelector<HTMLDivElement>('[data-map-pin-body]');
  if (!body) return;
  const selected = body.dataset.selected === 'true';
  body.style.transform = `scale(${
    selected
      ? MARKER_SCALE.selected
      : hovered
        ? MARKER_SCALE.hover
        : MARKER_SCALE.idle
  })`;
};

export const createMarkerPin = (
  item: MapItem,
  selected: boolean,
): HTMLDivElement => {
  const root = document.createElement('div');
  root.className =
    'group flex h-9 w-9 cursor-pointer items-end justify-center outline-none';
  root.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  root.style.userSelect = 'none';
  root.dataset.mapItemId = item.id;

  const body = document.createElement('div');
  body.dataset.mapPinBody = 'true';
  body.dataset.selected = selected ? 'true' : 'false';
  body.style.setProperty(
    '--map-pin-outline',
    selected ? 'var(--c-primary)' : 'var(--c-icon)',
  );
  body.className =
    'relative h-9 w-9 origin-bottom transition-transform duration-200 ease-out will-change-transform';
  body.style.transform = `scale(${
    selected ? MARKER_SCALE.selected : MARKER_SCALE.idle
  })`;
  body.innerHTML = markerPinMarkup(item.category);
  root.appendChild(body);
  return root;
};

/** 高德的 offset 是 content 左上角相对图钉尖坐标的位移。 */
export const markerOffset = (api: AmapApi) =>
  new api.Pixel(-MARKER_PIN_SIZE / 2, -MARKER_PIN_SIZE);
