import { defineThemeClassifierFile, defineThemeTokenCategory, defineThemeVariant } from '../../theme-system';

export const cockpitThemeClassifier = defineThemeClassifierFile({
  kind: 'theme',
  label: 'Cockpit Theme Classifier',
  source: 'cart/component-gallery/themes/cockpit/theme-classifier.ts',
});

export const cockpitDefaultTheme = defineThemeVariant({
  id: 'default',
  title: 'Cockpit',
  summary: 'Warm paper-black ATC aesthetic. Sweatshop cockpit base palette.',
  tokens: [
    defineThemeTokenCategory({
      id: 'surfaces',
      title: 'Surfaces',
      tokens: {
        bg: '#0e0b09',
        bg1: '#14100d',
        bg2: '#1a1511',
      },
    }),
    defineThemeTokenCategory({
      id: 'paper',
      title: 'Paper (Content Surface)',
      tokens: {
        paper: '#e8dcc4',           // primary warm paper — content background
        paperAlt: '#eadfca',        // softer cream — secondary content tier
        paperInk: '#2a1f14',        // dark warm ink on paper
        paperInkDim: '#7a6e5d',     // dimmer ink on paper (matches inkDimmer)
        paperRule: '#3a2a1e',       // border on paper (matches rule)
        paperRuleBright: '#8a4a20', // accent border on paper (matches ruleBright)
      },
    }),
    defineThemeTokenCategory({
      id: 'ink',
      title: 'Ink (Text)',
      tokens: {
        ink: '#f2e8dc',
        inkDim: '#b8a890',
        inkDimmer: '#7a6e5d',
        inkGhost: '#4a4238',
      },
    }),
    defineThemeTokenCategory({
      id: 'rules',
      title: 'Rules (Borders)',
      tokens: {
        rule: '#3a2a1e',
        ruleBright: '#8a4a20',
      },
    }),
    defineThemeTokenCategory({
      id: 'accent',
      title: 'Accent',
      tokens: {
        accent: '#d26a2a',
        accentHot: '#e8501c',
      },
    }),
    defineThemeTokenCategory({
      id: 'state',
      title: 'State Signals',
      tokens: {
        ok: '#6aa390',
        warn: '#d6a54a',
        flag: '#e14a2a',
      },
    }),
    defineThemeTokenCategory({
      id: 'auxiliary',
      title: 'Auxiliary',
      tokens: {
        lilac: '#8a7fd4',
        blue: '#5a8bd6',
      },
    }),
    defineThemeTokenCategory({
      id: 'categories',
      title: 'Category Tones (Data Channels)',
      tokens: {
        sys: '#5a8bd6',
        ctx: '#8a7fd4',
        usr: '#6aa390',
        ast: '#d26a2a',
        atch: '#d48aa7',
        tool: '#6ac3d6',
        wnd: '#e14a2a',
        pin: '#8aca6a',
      },
    }),
    defineThemeTokenCategory({
      id: 'decorative',
      title: 'Decorative',
      tokens: {
        gridDot: 'rgba(138, 74, 32, 0.08)',
        gridDotStrong: 'rgba(138, 74, 32, 0.18)',
      },
    }),
    defineThemeTokenCategory({
      id: 'typography',
      title: 'Typography',
      tokens: {
        fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
        fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
        lineHeight: 1.35,
      },
    }),
    defineThemeTokenCategory({
      id: 'type',
      title: 'Type Sizes',
      tokens: {
        micro: 7,
        tiny: 8,
        caption: 9,
        body: 10,
        base: 11,
        meta: 12,
        strong: 14,
        heading: 18,
      },
    }),
    defineThemeTokenCategory({
      id: 'radius',
      title: 'Corner Radius',
      tokens: {
        sm: 4,
        md: 6,
        lg: 8,
        xl: 10,
        pill: 99,
        round: 999,
      },
    }),
    defineThemeTokenCategory({
      id: 'letterSpacing',
      title: 'Letter Spacing',
      tokens: {
        tight: '0.05em',
        normal: '0.08em',
        wide: '0.1em',
        wider: '0.12em',
        widest: '0.15em',
        ultra: '0.2em',
        brand: '0.24em',
      },
    }),
    defineThemeTokenCategory({
      id: 'spacing',
      title: 'Spacing Rhythm',
      tokens: {
        x0: 1,
        x1: 2,
        x2: 4,
        x3: 6,
        x4: 8,
        x5: 10,
        x6: 12,
        x7: 16,
        x8: 18,
      },
    }),
    defineThemeTokenCategory({
      id: 'chrome',
      title: 'Chrome Heights',
      tokens: {
        topbar: 28,
        statusbar: 22,
        tileHead: 20,
        strip: 28,
      },
    }),
  ],
});
