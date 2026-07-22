import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

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
  theme: {
    colors: {
      ink: 'var(--c-ink)',
      paper: 'var(--c-paper)',
      mist: 'var(--c-mist)',
      line: 'var(--c-line)',
      muted: 'var(--c-muted)',
      icon: 'var(--c-icon)',
      primary: 'var(--c-primary)',
      primarySoft: 'var(--c-primary-soft)',
      accent: 'var(--c-accent)',
      accentSoft: 'var(--c-accent-soft)',
      panel: 'var(--c-panel)',
      elev: 'var(--c-elev)',
      codeBg: 'var(--c-code-bg)',
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
      },
      durations: {
        'skeleton-shimmer': '1.35s',
      },
      timingFns: {
        'skeleton-shimmer': 'ease-in-out',
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
    'docs-kbd':
      'inline-flex h-5 min-w-5 items-center justify-center rounded border border-line border-b-2 bg-mist px-[0.3rem] font-mono text-[0.7rem] font-semibold leading-none text-muted',
    'docs-figcaption':
      'mt-[-0.15rem] mb-[0.85rem] text-center text-[0.8125rem] leading-[1.45] text-muted',
    'cqu-logo-container':
      'mx-auto my-5 box-border flex h-64 w-64 max-w-full items-center justify-center rounded-[5px] bg-[#eee] p-2.5 [&_img]:m-0 [&_img]:block [&_img]:h-auto [&_img]:max-h-full [&_img]:w-auto [&_img]:max-w-full [&_img]:object-contain',
    'cqu-logo': 'm-0! block h-auto max-h-full w-auto max-w-full object-contain',
  },
  // Emitted into HTML via preprocess / markdown — not always visible to the scanner.
  safelist: ['docs-figcaption', 'cqu-logo-container', 'cqu-logo'],
});
