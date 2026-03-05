/**
 * Migration & Tooling — Layout2 zigzag narrative.
 *
 * Showcases ReactJIT's compatibility layers (tw(), HTML elements, div soup),
 * converter scripts (rjit convert, migrate), and build tooling pipeline.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useMemo } from 'react';
import { Box, Text, Image, ScrollView, Pressable, CodeBlock } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { tw } from '../../../packages/core/src/tw';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#f59e0b',
  accentDim: 'rgba(245, 158, 11, 0.12)',
  callout: 'rgba(245, 158, 11, 0.06)',
  calloutBorder: 'rgba(245, 158, 11, 0.25)',
  compat: '#22d3ee',
  convert: '#a78bfa',
  pipeline: '#34d399',
  migrate: '#f472b6',
  danger: '#ef4444',
  muted2: 'rgba(255,255,255,0.4)',
};

// ── Static code blocks (hoisted — never recreated) ──────

const TW_CODE = `import { tw } from '@reactjit/core'

// Tailwind classes → ReactJIT style objects. Zero install.
<Box style={tw("p-4 flex-row gap-2 bg-gray-800 rounded-lg")}>
  <Text style={tw("text-white text-sm font-bold")}>{'Hello'}</Text>
  <Box style={tw("w-1/2 bg-blue-500 rounded-md p-2")} />
</Box>

// Arbitrary values
<Box style={tw("w-[200] h-[120] bg-[#1a1a2e] rounded-[12]")} />

// Spacing, color, flex, border — full coverage
tw("px-6 py-3 mx-auto gap-4")   // → paddingLeft:24, paddingRight:24, ...
tw("bg-emerald-500/20")          // → backgroundColor with alpha
tw("flex-row items-center")      // → flexDirection:'row', alignItems:'center'`;

const HTML_CODE = `// Paste React+Tailwind JSX verbatim. It just works.

<div className="p-4 bg-gray-800 rounded-lg flex gap-2">
  <h1 className="text-white text-2xl font-bold">{'Title'}</h1>
  <span className="text-gray-400">{'subtitle'}</span>
  <button onClick={() => alert('hi')}>{'Click me'}</button>
</div>

// div → Box, span → Text, h1-h6 → Text (sized+bold)
// button → Pressable, img → Image, input → TextInput
// ul/ol → Box, li → row with bullet, table → flex grid
// section/header/nav/footer/article → Box`;

const CONVERT_CODE = `# Convert HTML/React to ReactJIT JSX
$ rjit convert app.tsx > app.reactjit.tsx

# Pipe mode — paste from clipboard
$ pbpaste | rjit convert > component.tsx

# Stdin interactive
$ rjit convert < legacy-component.tsx

# What it does:
#   div/span/section → Box/Text
#   className="..." → style={tw("...")}
#   inline styles → ReactJIT style objects
#   onClick → onPress, onMouseEnter → onPointerEnter
#   <img src> → <Image src>
#   <input> → <TextInput>`;

const MIGRATE_CODE = `# Full project migration — React+Express → ReactJIT
$ rjit migrate ./my-react-app

# Scans and classifies every file:
#   UI files     → convertToReactJIT (div→Box, tw classes)
#   Logic files  → TSL transpiler → Lua modules
#   Express API  → useServer() hooks
#   Assets       → copied directly
#   Mixed/unknown → flagged in MIGRATION.md

# Generates:
#   src/          ← converted components
#   lua/          ← transpiled logic
#   MIGRATION.md  ← TODO list with manual-fix items`;

const FLUTTER_CODE = `# Dart Flutter → ReactJIT
$ rjit migrate-flutter ./my_flutter_app

# Container → Box, Column → Box (flexDirection:'column')
# Row → Box (flexDirection:'row'), Scaffold → root Box
# Text('hello') → <Text>{'hello'}</Text>
# ElevatedButton → <Pressable>, TextField → <TextInput>
# EdgeInsets.all(16) → padding: 16
# setState(() => count++) → const [count, setCount] = useState(0)`;

const SWIFTUI_CODE = `# SwiftUI → ReactJIT
$ rjit migrate-swiftui ./MyApp

# VStack → Box (column), HStack → Box (row), ZStack → Box (relative)
# .padding(16) → paddingLeft:16, paddingRight:16, ...
# .background(Color.blue) → backgroundColor: '#3b82f6'
# @State var count = 0 → const [count, setCount] = useState(0)
# Button("Tap") { } → <Pressable onPress={() => {}}><Text>Tap</Text></Pressable>
# NavigationView → useNavigation()`;

const TKINTER_CODE = `# Python Tkinter → ReactJIT
$ rjit migrate-tkinter ./my_app.py

# Label → Text, Button → Pressable, Frame → Box
# Canvas → Box, Entry → TextInput, Listbox → ScrollView
# pack(side=LEFT, fill=BOTH) → flexDirection:'row', flexGrow:1
# grid(row=0, column=1) → nested flex Boxes
# StringVar() → useState<string>('')
# .bind('<Button-1>', fn) → onPress={fn}`;

const PYQT_CODE = `# PyQt6 → ReactJIT
$ rjit migrate-pyqt6 ./main_window.py

# QWidget/QMainWindow → Box, QLabel → Text
# QPushButton → Pressable, QLineEdit → TextInput
# QVBoxLayout → Box (column), QHBoxLayout → Box (row)
# QScrollArea → ScrollView
# signal.connect(slot) → onPress/onChange handlers
# QColor(r,g,b) → '#rrggbb' hex string`;

const BLESSED_CODE = `# Node.js blessed (terminal UI) → ReactJIT
$ rjit migrate-blessed ./dashboard.js

# box → Box, scrollablebox → ScrollView
# button → Pressable, textbox → TextInput
# list → ScrollView + Pressable items
# {bold}text{/bold} → fontWeight:'bold'
# {red-fg}error{/red-fg} → color:'#ef4444'
# border: { type: 'line' } → borderWidth: 1`;

const PIPELINE_CODE = `# The build pipeline — lint gates everything
$ rjit lint            # static layout linter (must pass first)
$ rjit build           # dev build (Love2D / iife)
$ rjit dev             # watch + HMR via dv CLI
$ rjit test spec.ts    # run specs inside Love2D process

# Production targets — cross-compile from any host
$ rjit build linux         # self-extracting x64 binary
$ rjit build macos         # macOS bundle (Intel)
$ rjit build macmseries    # macOS bundle (Apple Silicon)
$ rjit build windows       # Windows archive
$ rjit build dist:love     # portable Love2D binary`;

const SYNC_CODE = `# Source-of-truth architecture
#
# lua/             ← edit HERE (Lua runtime)
# packages/core/   ← edit HERE (React primitives)
# packages/renderer/ ← edit HERE (reconciler)
#          │
#    make cli-setup     →  cli/runtime/  (staging)
#          │
#    reactjit update    →  project/lua/  (consumer copy)
#          │
#    reactjit build     →  bundle.js     (final output)
#
# The storybook reads from source directly via symlinks.
# Never edit cli/runtime/ or project/lua/ — they're disposable.`;

const LINT_RULES = [
  { rule: 'no-mixed-text-children', desc: 'Text + expressions = 3 vertical nodes. Use template literals.' },
  { rule: 'no-padding-shorthand', desc: 'paddingHorizontal/paddingVertical rejected. Use paddingLeft/Right/Top/Bottom.' },
  { rule: 'no-dom-elements', desc: 'No <div>, <span>, <input> in non-compat mode. Use Box/Text/TextInput.' },
  { rule: 'no-hardcoded-colors', desc: 'Naked hex in style props. Use palette constant or useThemeColors().' },
  { rule: 'flexGrow-preferred', desc: 'Hardcoded height in flex child. Use flexGrow: 1 instead.' },
];

const ELEMENT_MAP = [
  { from: 'div, section, header', to: 'Box' },
  { from: 'nav, footer, article', to: 'Box' },
  { from: 'span, p, label', to: 'Text' },
  { from: 'strong, em, code, pre', to: 'Text' },
  { from: 'h1 – h6', to: 'Text (sized+bold)' },
  { from: 'button', to: 'Pressable' },
  { from: 'img', to: 'Image' },
  { from: 'input, textarea', to: 'TextInput' },
  { from: 'ul, ol', to: 'Box (column)' },
  { from: 'li', to: 'Box (row+bullet)' },
  { from: 'table, tr', to: 'Box (flex grid)' },
  { from: 'a', to: 'Pressable' },
];

const TW_CATEGORIES = [
  { cat: 'Spacing', examples: 'p-4, mx-2, gap-3, px-6, py-2' },
  { cat: 'Sizing', examples: 'w-full, h-1/2, w-[200], min-w-0' },
  { cat: 'Color', examples: 'bg-blue-500, text-white, border-gray-700' },
  { cat: 'Flex', examples: 'flex-row, flex-col, items-center, justify-between' },
  { cat: 'Border', examples: 'border, border-2, rounded-lg, rounded-[12]' },
  { cat: 'Font', examples: 'text-sm, text-2xl, font-bold, font-light' },
  { cat: 'Opacity', examples: 'opacity-50, bg-blue-500/20' },
  { cat: 'Arbitrary', examples: 'w-[200], h-[120], bg-[#1a1a2e]' },
];

const FRAMEWORK_COVERAGE = [
  { framework: 'React + Tailwind', cmd: 'rjit convert', status: 'full' },
  { framework: 'React + CSS', cmd: 'rjit convert', status: 'full' },
  { framework: 'Flutter (Dart)', cmd: 'rjit migrate-flutter', status: 'full' },
  { framework: 'SwiftUI', cmd: 'rjit migrate-swiftui', status: 'full' },
  { framework: 'Tkinter (Python)', cmd: 'rjit migrate-tkinter', status: 'full' },
  { framework: 'PyQt6 (Python)', cmd: 'rjit migrate-pyqt6', status: 'full' },
  { framework: 'Blessed (Node.js)', cmd: 'rjit migrate-blessed', status: 'full' },
  { framework: 'Express.js', cmd: 'rjit migrate', status: 'server' },
];

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children, color }: { icon: string; children: string; color?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={color ?? C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
  );
}

function Tag({ children, color }: { children: string; color: string }) {
  return (
    <Box style={{
      backgroundColor: color + '1a',
      borderRadius: 4,
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 2,
      paddingBottom: 2,
    }}>
      <Text style={{ color, fontSize: 8 }}>{children}</Text>
    </Box>
  );
}

// ── Live demos ───────────────────────────────────────────

function TailwindLiveDemo() {
  const c = useThemeColors();
  const [input, setInput] = useState('p-4 flex-row gap-2 bg-blue-500 rounded-lg');
  const resolved = useMemo(() => {
    try {
      const style = tw(input);
      return JSON.stringify(style, null, 2);
    } catch {
      return '// invalid class';
    }
  }, [input]);

  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 8,
    }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'LIVE: tw() PARSER'}</Text>
      <Box style={{
        backgroundColor: c.bg,
        borderRadius: 4,
        padding: 8,
        borderWidth: 1,
        borderColor: c.border,
      }}>
        <Text style={{ color: C.compat, fontSize: 9, fontFamily: 'monospace' }}>{`tw("${input}")`}</Text>
      </Box>
      <Box style={{ height: 1, backgroundColor: c.border }} />
      <Text style={{ color: c.muted, fontSize: 8 }}>{'Resolved style object:'}</Text>
      <Box style={{
        backgroundColor: c.bg,
        borderRadius: 4,
        padding: 8,
        borderWidth: 1,
        borderColor: c.border,
      }}>
        <Text style={{ color: c.text, fontSize: 8, fontFamily: 'monospace' }}>{resolved}</Text>
      </Box>
      {/* Preview row of clickable class combos */}
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {['p-4 flex-row gap-2 bg-blue-500 rounded-lg',
          'mx-auto w-1/2 text-center font-bold text-xl',
          'border-2 border-red-500 bg-red-500/10 rounded-[16]',
          'px-6 py-3 bg-gradient-to-r items-center justify-between',
        ].map((cls) => (
          <Pressable key={cls} onPress={() => setInput(cls)}>
            <Box style={{
              backgroundColor: input === cls ? C.accent + '33' : c.bg,
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 3,
              paddingBottom: 3,
              borderWidth: 1,
              borderColor: input === cls ? C.accent : c.border,
            }}>
              <Text style={{ color: input === cls ? C.accent : c.muted, fontSize: 7, fontFamily: 'monospace' }}>{cls.slice(0, 28)}</Text>
            </Box>
          </Pressable>
        ))}
      </Box>
    </Box>
  );
}

function ElementMapDemo() {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 4,
    }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'ELEMENT MAPPING'}</Text>
      <Box style={{ height: 1, backgroundColor: c.border, marginBottom: 2 }} />
      {ELEMENT_MAP.map((row) => (
        <Box key={row.from} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Box style={{ width: 180 }}>
            <Text style={{ color: C.danger, fontSize: 8, fontFamily: 'monospace' }}>{row.from}</Text>
          </Box>
          <Text style={{ color: c.muted, fontSize: 8 }}>{'→'}</Text>
          <Text style={{ color: C.pipeline, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }}>{row.to}</Text>
        </Box>
      ))}
    </Box>
  );
}

function FrameworkCoverageDemo() {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 4,
    }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'MIGRATION COVERAGE'}</Text>
      <Box style={{ height: 1, backgroundColor: c.border, marginBottom: 2 }} />
      {FRAMEWORK_COVERAGE.map((fw) => (
        <Box key={fw.framework} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Box style={{ width: 120 }}>
            <Text style={{ color: c.text, fontSize: 8 }}>{fw.framework}</Text>
          </Box>
          <Box style={{ width: 130 }}>
            <Text style={{ color: C.convert, fontSize: 8, fontFamily: 'monospace' }}>{fw.cmd}</Text>
          </Box>
          <Tag color={fw.status === 'full' ? C.pipeline : C.compat}>{fw.status === 'full' ? 'full' : 'server-side'}</Tag>
        </Box>
      ))}
    </Box>
  );
}

function TwCategoriesDemo() {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 4,
    }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'TAILWIND COVERAGE'}</Text>
      <Box style={{ height: 1, backgroundColor: c.border, marginBottom: 2 }} />
      {TW_CATEGORIES.map((row) => (
        <Box key={row.cat} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Box style={{ width: 60 }}>
            <Text style={{ color: C.accent, fontSize: 8, fontWeight: 'bold' }}>{row.cat}</Text>
          </Box>
          <Text style={{ color: c.muted, fontSize: 8, fontFamily: 'monospace' }}>{row.examples}</Text>
        </Box>
      ))}
    </Box>
  );
}

function LintRulesDemo() {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 6,
    }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'LINT RULES (GATE ALL BUILDS)'}</Text>
      <Box style={{ height: 1, backgroundColor: c.border, marginBottom: 2 }} />
      {LINT_RULES.map((rule) => (
        <Box key={rule.rule} style={{ gap: 2 }}>
          <Text style={{ color: C.danger, fontSize: 8, fontFamily: 'monospace', fontWeight: 'bold' }}>{rule.rule}</Text>
          <Text style={{ color: c.muted, fontSize: 8 }}>{rule.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

function PipelineFlowDemo() {
  const c = useThemeColors();
  const stages = [
    { label: 'Source', desc: 'lua/ + packages/', color: C.convert },
    { label: 'Lint', desc: 'rjit lint (gates build)', color: C.danger },
    { label: 'Bundle', desc: 'esbuild (iife format)', color: C.accent },
    { label: 'Sync', desc: 'make cli-setup', color: C.pipeline },
    { label: 'Update', desc: 'reactjit update', color: C.compat },
    { label: 'Ship', desc: 'rjit build <target>', color: C.migrate },
  ];
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 6,
    }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'BUILD PIPELINE'}</Text>
      <Box style={{ height: 1, backgroundColor: c.border, marginBottom: 4 }} />
      {stages.map((stage, i) => (
        <Box key={stage.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Box style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: stage.color + '33',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ color: stage.color, fontSize: 9, fontWeight: 'bold' }}>{String(i + 1)}</Text>
          </Box>
          <Box style={{ width: 50 }}>
            <Text style={{ color: c.text, fontSize: 9, fontWeight: 'bold' }}>{stage.label}</Text>
          </Box>
          <Text style={{ color: c.muted, fontSize: 8 }}>{stage.desc}</Text>
          {i < stages.length - 1 && (
            <Box style={{ flexGrow: 1 }} />
          )}
        </Box>
      ))}
    </Box>
  );
}

function CopyPasteDemo() {
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.bgElevated,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 8,
    }}>
      <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{'COPY-PASTE PROOF'}</Text>
      <Text style={{ color: c.muted, fontSize: 8 }}>{'This is real React+Tailwind JSX running in ReactJIT:'}</Text>
      <Box style={{ height: 1, backgroundColor: c.border }} />
      {/* Actual HTML+Tailwind rendering through compat layer */}
      <div className="p-4 bg-gray-800 rounded-lg w-full gap-3">
        <div className="flex-row items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 items-center justify-center">
            <span className="text-white font-bold text-sm">{'JD'}</span>
          </div>
          <div className="gap-1">
            <span className="text-white font-bold text-sm">{'Jane Doe'}</span>
            <span className="text-gray-400 text-xs">{'@janedoe'}</span>
          </div>
        </div>
        <span className="text-gray-300 text-xs">{'Just shipped my app with ReactJIT. Pasted my React components and they rendered pixel-perfect. No rewrite needed. 🚀'}</span>
        <div className="flex-row gap-3 pt-2">
          <span className="text-gray-500 text-xs">{'♡ 42'}</span>
          <span className="text-gray-500 text-xs">{'↻ 12'}</span>
          <span className="text-gray-500 text-xs">{'↗ 3'}</span>
        </div>
      </div>
    </Box>
  );
}

// ── Band style constants ─────────────────────────────────

const BAND = {
  flexDirection: 'row' as const,
  paddingLeft: 28,
  paddingRight: 28,
  paddingTop: 20,
  paddingBottom: 20,
  gap: 24,
  alignItems: 'center' as const,
};

const HALF = { flexGrow: 1, flexBasis: 0, gap: 8, alignItems: 'center' as const, justifyContent: 'center' as const };

// ── MigrationStory ───────────────────────────────────────

export function MigrationStory() {
  const c = useThemeColors();

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="refresh-cw" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Migration & Tooling'}
        </Text>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'cli + compat'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Tailwind, HTML compat, converters, cross-framework migration, build pipeline'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'From any framework to ReactJIT in one command.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Paste React+Tailwind verbatim and it renders. Convert Flutter, SwiftUI, Tkinter, PyQt6, and Blessed with dedicated migrators. The CLI handles linting, bundling, cross-compilation, and runtime syncing — so you never touch esbuild flags or copy files manually.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: TAILWIND — demo | text+code (left=demo, right=text) ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <TailwindLiveDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="code" color={C.compat}>{'TAILWIND COMPAT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Zero-install Tailwind parser built into @reactjit/core. Pass class strings to tw() and get native style objects. Covers spacing, sizing, colors (with alpha), flex, borders, fonts, and arbitrary values via bracket syntax.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={TW_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 2: TW COVERAGE — text | demo (left=text, right=demo) ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="layers" color={C.compat}>{'CLASS COVERAGE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The tw() parser handles the full Tailwind utility surface: spacing scale (0-96), fractional widths, the complete color palette with shade variants, flexbox, borders with radius, font sizes (xs-9xl), weights, opacity, and arbitrary values in square brackets.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'No PostCSS. No build step. No node_modules. Just a pure TypeScript function that maps class names to style objects at call time.'}
            </Text>
          </Box>
          <Box style={HALF}>
            <TwCategoriesDemo />
          </Box>
        </Box>

        {/* ── Callout: why compat exists ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 16,
          paddingBottom: 16,
          gap: 6,
        }}>
          <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>
            {'Why compatibility layers?'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 9 }}>
            {'ReactJIT has no DOM. No CSS. No browser. Components are geometry descriptions for a GPU painter. But developers have muscle memory — they reach for className, <div>, and Tailwind utilities. Instead of fighting that, we parse it. tw() converts classes to style objects. HTML elements remap to primitives. You paste your React code and it works. Then you gradually adopt native primitives as you learn the system.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 3: HTML ELEMENTS — demo | text+code ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <ElementMapDemo />
            <CopyPasteDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="box" color={C.compat}>{'HTML ELEMENT REMAPPING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Every standard HTML element is remapped to a ReactJIT primitive at the reconciler level. div becomes Box. span becomes Text. button becomes Pressable. Combined with tw(), you can paste a React+Tailwind component from any codebase and it renders immediately.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={HTML_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 4: CONVERTER CLI — text+code | demo ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="terminal" color={C.convert}>{'CONVERTER CLI'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'For batch conversion of existing React codebases, rjit convert transforms HTML/JSX to native ReactJIT primitives. It resolves Tailwind classes, remaps DOM events, normalizes inline styles, and extracts text content. Pipe mode works with clipboard for quick one-offs.'}
            </Text>
            <CodeBlock language="bash" fontSize={9} code={CONVERT_CODE} />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="git-merge" color={C.migrate}>{'PROJECT MIGRATION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Full-project migration scans every file, classifies it (UI, logic, server, assets), and routes each through the right converter. Express routes become useServer() hooks. Business logic transpiles to Lua. A MIGRATION.md report flags anything that needs manual attention.'}
            </Text>
            <CodeBlock language="bash" fontSize={9} code={MIGRATE_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 5: CROSS-FRAMEWORK — demo | text+code ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <FrameworkCoverageDemo />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="globe" color={C.migrate}>{'CROSS-FRAMEWORK MIGRATION'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Dedicated migrators for six frameworks. Each understands the source framework\'s widget tree, layout model, state management, and event system. The output is idiomatic ReactJIT — not a mechanical translation, but real components with proper flex layout, hooks, and event handlers.'}
            </Text>
          </Box>
        </Box>

        {/* ── Sub-bands: framework details (compact two-column code blocks) ── */}
        <Box style={{
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 4,
          paddingBottom: 16,
          gap: 12,
        }}>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center' }}>
              <CodeBlock language="bash" fontSize={8} code={FLUTTER_CODE} />
            </Box>
            <Box style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center' }}>
              <CodeBlock language="bash" fontSize={8} code={SWIFTUI_CODE} />
            </Box>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center' }}>
              <CodeBlock language="bash" fontSize={8} code={TKINTER_CODE} />
            </Box>
            <Box style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center' }}>
              <CodeBlock language="bash" fontSize={8} code={PYQT_CODE} />
            </Box>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 12 }}>
            <Box style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center' }}>
              <CodeBlock language="bash" fontSize={8} code={BLESSED_CODE} />
            </Box>
            <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
              {/* rjit-ignore-next-line */}
              <Text style={{ color: c.muted, fontSize: 9, fontStyle: 'italic' }}>
                {'All migrators use a shared IR (intermediate representation) and the same component assembly pipeline. Custom framework? Implement parse + generate against migration-core.mjs.'}
              </Text>
            </Box>
          </Box>
        </Box>

        {/* ── Callout: migration philosophy ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 16,
          paddingBottom: 16,
          gap: 6,
        }}>
          <Text style={{ color: c.text, fontSize: 10, fontWeight: 'bold' }}>
            {'Migration is a spectrum, not a switch.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 9 }}>
            {'Start by pasting your existing code — tw() and HTML compat handle it. Run rjit convert for batch cleanup. Use dedicated migrators for non-React codebases. Over time, adopt native primitives (Box, Text, Pressable) and hooks (useHotState, useLocalStore) as you learn the system. There\'s no deadline. The compat layer doesn\'t go away.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 6: BUILD PIPELINE — text+code | demo ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <SectionLabel icon="cpu" color={C.pipeline}>{'BUILD PIPELINE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'The CLI encodes all esbuild flags, enforces lint gates before every build, handles runtime file placement, and produces correct distribution packages for five platforms. Never run raw esbuild. Never copy Lua files manually. The pipeline does it.'}
            </Text>
            <CodeBlock language="bash" fontSize={9} code={PIPELINE_CODE} />
          </Box>
          <Box style={HALF}>
            <PipelineFlowDemo />
            <LintRulesDemo />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: SOURCE-OF-TRUTH — code | text ── */}
        <Box style={BAND}>
          <Box style={HALF}>
            <CodeBlock language="bash" fontSize={9} code={SYNC_CODE} />
          </Box>
          <Box style={HALF}>
            <SectionLabel icon="database" color={C.pipeline}>{'SOURCE-OF-TRUTH ARCHITECTURE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Framework files flow one way: source → staging → consumer. Edit lua/ and packages/ at the monorepo root. make cli-setup copies to cli/runtime/. reactjit update copies from cli/runtime/ into your project. The storybook bypasses this entirely — it reads from source via symlinks.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Never edit cli/runtime/ or project/lua/ directly. Those are disposable copies. The storybook\'s lua/ directory is a symlink — never replace it with a real directory. reactjit update is symlink-aware and will skip protected paths.'}
            </Text>
          </Box>
        </Box>

        {/* ── Footer padding ── */}
        <Box style={{ height: 24 }} />

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 8,
        paddingBottom: 8,
      }}>
        <Text style={{ color: c.muted, fontSize: 9 }}>
          {'reactjit / cli / compat'}
        </Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>
          {'rjit convert · rjit migrate · rjit build · rjit lint · tw()'}
        </Text>
      </Box>
    </Box>
  );
}
