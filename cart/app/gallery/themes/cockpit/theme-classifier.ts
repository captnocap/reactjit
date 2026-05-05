import { defineThemeClassifierFile, defineThemeTokenCategory, defineThemeVariant } from '../../theme-system';

export const cockpitThemeClassifier = defineThemeClassifierFile({
  kind: 'theme',
  label: 'Cockpit Theme Classifier',
  source: 'cart/app/gallery/themes/cockpit/theme-classifier.ts',
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
        transparent: 'transparent',
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

export const cockpitSignalTheme = defineThemeVariant({
  id: 'signal',
  title: 'Signal Room',
  summary: 'Cold green-black operations palette with amber control accents. Same token vocabulary, different values.',
  tokens: [
    defineThemeTokenCategory({
      id: 'surfaces',
      title: 'Surfaces',
      tokens: {
        bg: '#06110f',
        bg1: '#0b1b17',
        bg2: '#10271f',
      },
    }),
    defineThemeTokenCategory({
      id: 'paper',
      title: 'Paper (Content Surface)',
      tokens: {
        paper: '#d8f0df',
        paperAlt: '#cce7d6',
        paperInk: '#10231b',
        paperInkDim: '#51695b',
        paperRule: '#24483d',
        paperRuleBright: '#2f8f73',
      },
    }),
    defineThemeTokenCategory({
      id: 'ink',
      title: 'Ink (Text)',
      tokens: {
        ink: '#eafff2',
        inkDim: '#9fc8b4',
        inkDimmer: '#60786b',
        inkGhost: '#34493f',
      },
    }),
    defineThemeTokenCategory({
      id: 'rules',
      title: 'Rules (Borders)',
      tokens: {
        rule: '#24483d',
        ruleBright: '#2f8f73',
      },
    }),
    defineThemeTokenCategory({
      id: 'accent',
      title: 'Accent',
      tokens: {
        accent: '#e0a84f',
        accentHot: '#ff6b2f',
      },
    }),
    defineThemeTokenCategory({
      id: 'state',
      title: 'State Signals',
      tokens: {
        ok: '#4ed08f',
        warn: '#f1c257',
        flag: '#ff5f4c',
      },
    }),
    defineThemeTokenCategory({
      id: 'auxiliary',
      title: 'Auxiliary',
      tokens: {
        lilac: '#8ea4ff',
        blue: '#4aa7d8',
      },
    }),
    defineThemeTokenCategory({
      id: 'categories',
      title: 'Category Tones (Data Channels)',
      tokens: {
        sys: '#4aa7d8',
        ctx: '#8ea4ff',
        usr: '#4ed08f',
        ast: '#e0a84f',
        atch: '#e284a4',
        tool: '#59d3c7',
        wnd: '#ff5f4c',
        pin: '#9dd45a',
      },
    }),
    defineThemeTokenCategory({
      id: 'decorative',
      title: 'Decorative',
      tokens: {
        transparent: 'transparent',
        gridDot: 'rgba(47, 143, 115, 0.10)',
        gridDotStrong: 'rgba(47, 143, 115, 0.22)',
      },
    }),
    defineThemeTokenCategory({
      id: 'typography',
      title: 'Typography',
      tokens: {
        fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
        fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
        lineHeight: 1.32,
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
        sm: 2,
        md: 3,
        lg: 4,
        xl: 6,
        pill: 99,
        round: 999,
      },
    }),
    defineThemeTokenCategory({
      id: 'letterSpacing',
      title: 'Letter Spacing',
      tokens: {
        tight: '0.04em',
        normal: '0.07em',
        wide: '0.1em',
        wider: '0.13em',
        widest: '0.16em',
        ultra: '0.22em',
        brand: '0.26em',
      },
    }),
    defineThemeTokenCategory({
      id: 'spacing',
      title: 'Spacing Rhythm',
      tokens: {
        x0: 1,
        x1: 2,
        x2: 3,
        x3: 5,
        x4: 7,
        x5: 9,
        x6: 11,
        x7: 14,
        x8: 16,
      },
    }),
    defineThemeTokenCategory({
      id: 'chrome',
      title: 'Chrome Heights',
      tokens: {
        topbar: 26,
        statusbar: 20,
        tileHead: 18,
        strip: 26,
      },
    }),
  ],
});

export const cockpitBasicLightTheme = defineThemeVariant({
  id: 'light',
  title: 'Basic Light',
  summary: 'Neutral light mode using the existing cockpit token vocabulary. Airier spacing, larger type, and softer radii.',
  tokens: [
    defineThemeTokenCategory({
      id: 'surfaces',
      title: 'Surfaces',
      tokens: {
        bg: '#f6f3eb',
        bg1: '#ffffff',
        bg2: '#ebe6da',
      },
    }),
    defineThemeTokenCategory({
      id: 'paper',
      title: 'Paper (Content Surface)',
      tokens: {
        paper: '#ffffff',
        paperAlt: '#f3efe6',
        paperInk: '#1f2328',
        paperInkDim: '#667085',
        paperRule: '#d0d7de',
        paperRuleBright: '#7a91b5',
      },
    }),
    defineThemeTokenCategory({
      id: 'ink',
      title: 'Ink (Text)',
      tokens: {
        ink: '#1f2328',
        inkDim: '#57606a',
        inkDimmer: '#8c959f',
        inkGhost: '#c9d1d9',
      },
    }),
    defineThemeTokenCategory({
      id: 'rules',
      title: 'Rules (Borders)',
      tokens: {
        rule: '#d0d7de',
        ruleBright: '#7a91b5',
      },
    }),
    defineThemeTokenCategory({
      id: 'accent',
      title: 'Accent',
      tokens: {
        accent: '#2563eb',
        accentHot: '#0f4fd1',
      },
    }),
    defineThemeTokenCategory({
      id: 'state',
      title: 'State Signals',
      tokens: {
        ok: '#16845b',
        warn: '#b7791f',
        flag: '#d1242f',
      },
    }),
    defineThemeTokenCategory({
      id: 'auxiliary',
      title: 'Auxiliary',
      tokens: {
        lilac: '#7c3aed',
        blue: '#2563eb',
      },
    }),
    defineThemeTokenCategory({
      id: 'categories',
      title: 'Category Tones (Data Channels)',
      tokens: {
        sys: '#2563eb',
        ctx: '#7c3aed',
        usr: '#16845b',
        ast: '#b65f00',
        atch: '#c24175',
        tool: '#0891b2',
        wnd: '#d1242f',
        pin: '#4d7c0f',
      },
    }),
    defineThemeTokenCategory({
      id: 'decorative',
      title: 'Decorative',
      tokens: {
        transparent: 'transparent',
        gridDot: 'rgba(37, 99, 235, 0.08)',
        gridDotStrong: 'rgba(37, 99, 235, 0.18)',
      },
    }),
    defineThemeTokenCategory({
      id: 'typography',
      title: 'Typography',
      tokens: {
        fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
        fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
        lineHeight: 1.42,
      },
    }),
    defineThemeTokenCategory({
      id: 'type',
      title: 'Type Sizes',
      tokens: {
        micro: 8,
        tiny: 9,
        caption: 10,
        body: 12,
        base: 13,
        meta: 12,
        strong: 16,
        heading: 24,
      },
    }),
    defineThemeTokenCategory({
      id: 'radius',
      title: 'Corner Radius',
      tokens: {
        sm: 8,
        md: 12,
        lg: 18,
        xl: 24,
        pill: 99,
        round: 999,
      },
    }),
    defineThemeTokenCategory({
      id: 'letterSpacing',
      title: 'Letter Spacing',
      tokens: {
        tight: '0.01em',
        normal: '0.02em',
        wide: '0.04em',
        wider: '0.06em',
        widest: '0.08em',
        ultra: '0.1em',
        brand: '0.12em',
      },
    }),
    defineThemeTokenCategory({
      id: 'spacing',
      title: 'Spacing Rhythm',
      tokens: {
        x0: 2,
        x1: 4,
        x2: 6,
        x3: 8,
        x4: 12,
        x5: 16,
        x6: 20,
        x7: 24,
        x8: 32,
      },
    }),
    defineThemeTokenCategory({
      id: 'chrome',
      title: 'Chrome Heights',
      tokens: {
        topbar: 40,
        statusbar: 28,
        tileHead: 30,
        strip: 34,
      },
    }),
  ],
});

export const cockpitDarkModeTheme = defineThemeVariant({
  id: 'dark',
  title: 'Dark Mode',
  summary: 'Neutral dark mode using the same token vocabulary. Compact spacing, sharper corners, and high contrast control surfaces.',
  tokens: [
    defineThemeTokenCategory({
      id: 'surfaces',
      title: 'Surfaces',
      tokens: {
        bg: '#07090d',
        bg1: '#0e131b',
        bg2: '#151c27',
      },
    }),
    defineThemeTokenCategory({
      id: 'paper',
      title: 'Paper (Content Surface)',
      tokens: {
        paper: '#101820',
        paperAlt: '#172330',
        paperInk: '#ecf3ff',
        paperInkDim: '#9aa7ba',
        paperRule: '#2a3848',
        paperRuleBright: '#5ba7ff',
      },
    }),
    defineThemeTokenCategory({
      id: 'ink',
      title: 'Ink (Text)',
      tokens: {
        ink: '#ecf3ff',
        inkDim: '#a8b3c7',
        inkDimmer: '#657185',
        inkGhost: '#2d3748',
      },
    }),
    defineThemeTokenCategory({
      id: 'rules',
      title: 'Rules (Borders)',
      tokens: {
        rule: '#263241',
        ruleBright: '#5ba7ff',
      },
    }),
    defineThemeTokenCategory({
      id: 'accent',
      title: 'Accent',
      tokens: {
        accent: '#6bb7ff',
        accentHot: '#36d7ff',
      },
    }),
    defineThemeTokenCategory({
      id: 'state',
      title: 'State Signals',
      tokens: {
        ok: '#42d392',
        warn: '#f2c94c',
        flag: '#ff5c7a',
      },
    }),
    defineThemeTokenCategory({
      id: 'auxiliary',
      title: 'Auxiliary',
      tokens: {
        lilac: '#a78bfa',
        blue: '#5ba7ff',
      },
    }),
    defineThemeTokenCategory({
      id: 'categories',
      title: 'Category Tones (Data Channels)',
      tokens: {
        sys: '#5ba7ff',
        ctx: '#a78bfa',
        usr: '#42d392',
        ast: '#ffb86b',
        atch: '#ff7ab6',
        tool: '#36d7ff',
        wnd: '#ff5c7a',
        pin: '#a3e635',
      },
    }),
    defineThemeTokenCategory({
      id: 'decorative',
      title: 'Decorative',
      tokens: {
        transparent: 'transparent',
        gridDot: 'rgba(91, 167, 255, 0.10)',
        gridDotStrong: 'rgba(91, 167, 255, 0.24)',
      },
    }),
    defineThemeTokenCategory({
      id: 'typography',
      title: 'Typography',
      tokens: {
        fontMono: "'JetBrains Mono', 'IBM Plex Mono', 'Menlo', monospace",
        fontSans: "'Inter Tight', 'Inter', system-ui, sans-serif",
        lineHeight: 1.32,
      },
    }),
    defineThemeTokenCategory({
      id: 'type',
      title: 'Type Sizes',
      tokens: {
        micro: 7,
        tiny: 8,
        caption: 9,
        body: 11,
        base: 12,
        meta: 12,
        strong: 15,
        heading: 22,
      },
    }),
    defineThemeTokenCategory({
      id: 'radius',
      title: 'Corner Radius',
      tokens: {
        sm: 2,
        md: 4,
        lg: 6,
        xl: 8,
        pill: 99,
        round: 999,
      },
    }),
    defineThemeTokenCategory({
      id: 'letterSpacing',
      title: 'Letter Spacing',
      tokens: {
        tight: '0.04em',
        normal: '0.07em',
        wide: '0.1em',
        wider: '0.12em',
        widest: '0.16em',
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
        x7: 14,
        x8: 18,
      },
    }),
    defineThemeTokenCategory({
      id: 'chrome',
      title: 'Chrome Heights',
      tokens: {
        topbar: 30,
        statusbar: 22,
        tileHead: 20,
        strip: 26,
      },
    }),
  ],
});
