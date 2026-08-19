import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';
import { LAYOUT_BREAKPOINTS } from './app/theme/breakpoints';
import { colors, paletteCss } from './app/theme/colors';
import { height, layoutCss, minHeight, spacing } from './app/theme/layout';

export default defineConfig({
  presets: [
    presetWind3({
      dark: {
        dark: '[data-theme="dark"]',
        light: '[data-theme="light"]',
      },
    }),
    presetAttributify(),
    presetIcons({ scale: 1.05 }),
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  preflights: [{ getCSS: () => `${paletteCss}\n\n${layoutCss}` }],
  theme: {
    breakpoints: LAYOUT_BREAKPOINTS,
    colors: {
      ...colors,
      /* Filled per instance by Admonition's inline style. */
      callout: 'var(--callout)',
      'callout-bg': 'var(--callout-bg)',
      'callout-title': 'var(--callout-title)',
    },
    spacing,
    height,
    minHeight,
    boxShadow: {
      'rail-active': 'inset 2px 0 0 var(--c-primary)',
      'chip-outline': 'inset 0 0 0 1px var(--c-icon)',
      'radio-dot': 'inset 0 0 0 0.28rem var(--c-primary)',
      'drop-ring': '0 0 0 4px var(--c-primary-soft)',
    },
    /* Singular — uno reads theme[`gridTemplate${Column|Row}`]. */
    gridTemplateColumn: {
      /* The three shell layouts. Sidebar and toc collapse at their breakpoints,
         and the header carries an extra auto column for its actions. */
      docs: 'var(--layout-sidebar) minmax(0,1fr)',
      'docs-toc': 'var(--layout-sidebar) minmax(0,1fr) var(--layout-toc)',
      'docs-header': 'var(--layout-sidebar) minmax(0,1fr) auto',
    },
    fontFamily: {
      display: 'var(--font-display)',
      sans: 'var(--font-sans)',
      mono: 'var(--font-mono)',
    },
    animation: {
      keyframes: {
        'skeleton-shimmer':
          '{0%{background-position:100% 0}100%{background-position:-100% 0}}',
        'tab-in-right':
          '{from{opacity:0;transform:translate3d(0.6rem,0,0)}to{opacity:1;transform:none}}',
        'tab-in-left':
          '{from{opacity:0;transform:translate3d(-0.6rem,0,0)}to{opacity:1;transform:none}}',
      },
      durations: {
        'skeleton-shimmer': '1.35s',
        'tab-in-right': '0.2s',
        'tab-in-left': '0.2s',
      },
      timingFns: {
        'skeleton-shimmer': 'ease-in-out',
        'tab-in-right': 'cubic-bezier(0.2, 0, 0, 1)',
        'tab-in-left': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      counts: {
        'skeleton-shimmer': 'infinite',
      },
    },
  },
  shortcuts: {
    'docs-prose': 'flex flex-col gap-[0.35rem]',
    'docs-title-row':
      'mb-2 flex items-center gap-2 [&>h1]:m-0 [&>h1]:min-w-0 [&>h1]:flex-1 [&>button]:shrink-0 [&>button]:self-center',
    /* Homepage variant: same row as title, but the manual link sits on the right. */
    'docs-home-title-row':
      'mb-2 flex items-center gap-3 [&>h1]:m-0 [&>h1]:min-w-0 [&>h1]:flex-1',
    'docs-kbd':
      'inline-flex h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-[0.25rem] border border-line bg-panel px-1 font-mono text-[0.6875rem] font-medium leading-none text-muted select-none',
    'docs-figcaption':
      'mt-[-0.15rem] mb-[0.85rem] text-center text-[0.8125rem] leading-[1.45] text-muted',
    'cqu-logo-container':
      'mx-auto my-5 box-border flex h-64 w-64 max-w-full items-center justify-center rounded-[5px] bg-[#eee] p-2.5 [&_img]:m-0 [&_img]:block [&_img]:h-auto [&_img]:max-h-full [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain',
    'cqu-logo': 'm-0! block h-auto max-h-full w-auto max-w-full object-contain',
  },
  // Emitted into HTML via preprocess / markdown — not always visible to the scanner.
  safelist: ['docs-figcaption', 'cqu-logo-container', 'cqu-logo'],
});
