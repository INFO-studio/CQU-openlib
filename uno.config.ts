import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
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
  },
});
