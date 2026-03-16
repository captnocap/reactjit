---
title: Advanced Patterns
description: Component composition, multi-file imports, classifiers, pre-compile mode, utility functions, animations, and routing
category: Advanced
keywords: component composition, imports, children, classifiers, cls.tsz, compile-runtime, gen.zig, useTransition, useSpring, Routes, navigate
related: Compiler, Architecture, State
difficulty: advanced
---

## Overview

This section covers patterns that go beyond single-file apps: splitting code across files, building design systems with classifiers, embedding compiled fragments into the runtime, and using the animation and routing APIs.

---

## Component Composition

### Defining Components

Any `function` with an uppercase name (except `App`) is a component. The compiler's first pass (`collectComponents`) scans all function definitions and records each component's name, prop list, and the token offset of its JSX return.

```tsz
function Badge({ text, bg }: { text: string; bg: string }) {
  return (
    <Box style={{ padding: 6, backgroundColor: bg, borderRadius: 4 }}>
      <Text fontSize={11} color="#ffffff">{text}</Text>
    </Box>
  );
}
```

Components are **inlined at compile time** via `inlineComponent()`. There is no function call at runtime — the compiler substitutes prop values and splices the JSX tree directly into the parent context. The resulting `.gen.zig` contains no component dispatch.

### Props

Props are declared as a destructured object parameter. Type annotations (`{ text: string; bg: string }`) are parsed and discarded — they serve as documentation only.

```tsz
function Button({ label, color }) {
  return (
    <Pressable style={{ backgroundColor: color, padding: 12, borderRadius: 6 }}>
      <Text fontSize={14} color="#ffffff">{label}</Text>
    </Pressable>
  );
}

// Usage — props are substituted at compile time:
<Button label="Save" color="#4caf50" />
<Button label="Cancel" color="#f44336" />
```

Props can be strings, numbers, expressions, or handler functions (`onPress`, `onChangeText`). The compiler recognizes handler props by the `on[A-Z]` naming convention and wires them through the event system.

### Children Forwarding

If a component renders `{children}`, the compiler scans its body for the `children` identifier during `collectComponents`. When the component is used with child elements, those elements are collected and spliced at the `{children}` site.

```tsz
function Card({ children }: { children: any }) {
  return (
    <Box style={{ padding: 16, backgroundColor: '#2d2d3f', borderRadius: 8 }}>
      {children}
    </Box>
  );
}

// Usage — children are inlined into Card's Box at compile time:
<Card>
  <Text fontSize={16} color="#aaaaaa">This is a child.</Text>
  <Text fontSize={14} color="#666688">So is this.</Text>
</Card>
```

If a component body does not reference `{children}`, any children passed at the call site are silently discarded.

### Limits

| Limit | Value |
|---|---|
| Components per file | 64 |
| Props per component | 64 |

---

## Multi-File Projects

### Import Syntax

Use ES module `import` syntax to bring in components from other `.tsz` files:

```tsz
import { Button } from './components/Button.tsz';
import { Card } from './components/Card.tsz';
import { Header } from './components/Header.tsz';
```

The compiler resolves these imports relative to the entry file, reads each imported file, and merges their token streams before codegen. All components from all files become available in the same namespace. Circular and duplicate imports are deduplicated automatically.

### How File Merging Works

When compiling `BuildMonitor.tsz`:

1. Compiler reads `BuildMonitor.tsz`, finds `import` statements
2. Reads each imported file (e.g. `StatusBar.tsz`, `InfoCard.tsz`, `ActionButton.tsz`, `style.cls.tsz`)
3. If imported files have their own imports (e.g. `InfoCard.tsz` also imports `style.cls.tsz`), those are resolved transitively and deduplicated
4. All source is merged into one token stream
5. One `.gen.zig` fragment is produced

Five `.tsz` files become one `.gen.zig`. The Zig compiler sees a single module.

### Example: Multi-file Project

```
multi-file/
  BuildMonitor.tsz   ← entry point (imported by runtime)
  StatusBar.tsz
  InfoCard.tsz
  ActionButton.tsz
  style.cls.tsz      ← shared classifiers (imported by multiple components)
```

```tsz
// BuildMonitor.tsz
import { Panel, Section, Row, Spacer, Heading, Caption } from './style.cls';
import { StatusBar } from './StatusBar';
import { InfoCard } from './InfoCard';
import { ActionButton } from './ActionButton';

function App() {
  const [builds, setBuilds] = useState(0);
  return (
    <C.Panel>
      <C.Section>
        <C.Heading>Build Monitor</C.Heading>
        <C.Row>
          <InfoCard title="BUILDS" value={builds} color="#4ec9b0" />
          <InfoCard title="PASSED" value={builds * 2} color="#e94560" />
        </C.Row>
        <ActionButton label="Trigger Build" onPress={() => setBuilds(builds + 1)} />
      </C.Section>
      <C.Spacer />
      <StatusBar />
    </C.Panel>
  );
}
```

```tsz
// InfoCard.tsz — a leaf component
import { Card, Label } from './style.cls';

function InfoCard({ title, value, color }) {
  return (
    <C.Card>
      <C.Label>{title}</C.Label>
      <Text fontSize={28} color={color}>{value}</Text>
    </C.Card>
  );
}
```

---

## Classifiers (.cls.tsz)

Classifiers are the `.tsz` design system primitive. A `.cls.tsz` file defines named styled components using a `classifier({})` block. Each entry maps a name to a primitive type with preset style/prop defaults.

```tsz
// style.cls.tsz
classifier({
  Panel:   { type: 'Box', style: { width: '100%', height: '100%', backgroundColor: '#1a1a2e' } },
  Section: { type: 'Box', style: { padding: 24 } },
  Row:     { type: 'Box', style: { flexDirection: 'row', marginTop: 16 } },
  Spacer:  { type: 'Box', style: { flexGrow: 1 } },

  Heading: { type: 'Text', fontSize: 24, color: '#e94560' },
  Caption: { type: 'Text', fontSize: 12, color: '#555555' },
  Label:   { type: 'Text', fontSize: 11, color: '#555555' },

  Button:  { type: 'Pressable', style: { padding: 12, backgroundColor: '#0f3460', borderRadius: 6 } },
})
```

Classifiers are used via the `C.` namespace:

```tsz
import { Panel, Section, Heading, Button } from './style.cls';

function App() {
  return (
    <C.Panel>
      <C.Section>
        <C.Heading>My App</C.Heading>
        <C.Button onPress={() => doThing()}>
          <Text fontSize={14} color="#fff">Click</Text>
        </C.Button>
      </C.Section>
    </C.Panel>
  );
}
```

Classifiers eliminate repeated inline styles. Define typography, spacing, and color tokens once; use everywhere. Child content is forwarded into the underlying primitive automatically.

---

## Pre-Compile Mode

### What It Is

Pre-compile mode produces a `.gen.zig` fragment instead of a full standalone app. The fragment exposes a public API (`init`, `tick`, `getRoot`, named accessors) and is designed to be `@import`ed by the runtime.

```bash
# Full app build (produces main() + event loop):
./zig-out/bin/tsz build app.tsz

# Pre-compile (produces .gen.zig fragment for runtime embedding):
./zig-out/bin/tsz compile-runtime tsz/devtools/DevtoolsPanel.tsz
```

### Fragment API

A pre-compiled fragment exposes:

| Export | Description |
|---|---|
| `init()` | Initialize state slots, set up node tree |
| `tick()` | Called every frame; updates dynamic text, conditionals, animations |
| `getRoot()` | Returns `*Node` — the root of the component tree |
| Named accessors | For specific nodes the runtime needs to reach directly |

### How the Runtime Uses Fragments

```zig
// In main.zig or compositor.zig:
const devtools = @import("compiled/framework/devtoolspanel.gen.zig");

// At startup:
devtools.init();

// Every frame:
devtools.tick();
const root = devtools.getRoot();
layout.layout(root, 0, 0, panel_w, panel_h);
// ... paint root ...
```

To Zig, a `.gen.zig` is just another module. It undergoes full optimization — inlining, dead code elimination, constant folding. The fact that it was generated from `.tsz` is invisible to the Zig compiler.

### Never Edit .gen.zig

`.gen.zig` files are build artifacts. If you need to change the UI, edit the `.tsz` source and recompile. Editing `.gen.zig` directly will be overwritten on the next compile and creates a false source of truth.

```
tsz/runtime/compiled/framework/  ← framework artifacts (.gen.zig)
tsz/runtime/compiled/user/       ← user artifacts (.gen.zig)
```

---

## Utility Functions

Lowercase functions that are not `App` and do not start with a capital letter are **utility functions** — they compile to standalone Zig functions, not components.

```tsz
function clamp(val: number, min: number, max: number): number {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

function formatMs(ms: number): string {
  return `${ms}ms`;
}

function App() {
  const [vol, setVol] = useState(50);
  return (
    <Box>
      <Text fontSize={14} color="#fff">{`Volume: ${clamp(vol, 0, 100)}`}</Text>
    </Box>
  );
}
```

Utility functions can be called from event handlers and template literals. They cannot return JSX — only values.

---

## Animations

### useTransition

`useTransition` animates a value from its current state to a target over a fixed duration with an easing function.

```tsz
function App() {
  const [visible, setVisible] = useState(1);
  const opacity = useTransition(visible, { duration: 300, easing: 'easeInOut' });

  return (
    <Box style={{ opacity: opacity }}>
      <Text fontSize={16} color="#fff">Fade me</Text>
    </Box>
  );
}
```

The compiler generates an `animate.Transition` struct and wires the animated value to the style binding. The transition runs in the `tick()` function every frame.

### useSpring

`useSpring` animates a value using a spring physics model (stiffness + damping).

```tsz
function App() {
  const [scale, setScale] = useState(1.0);
  const animScale = useSpring(scale, { stiffness: 200, damping: 20 });

  return (
    <Pressable onPress={() => setScale(scale === 1.0 ? 1.3 : 1.0)}>
      <Box style={{ width: 100, height: 100, transform: `scale(${animScale})` }}>
        <Text fontSize={14} color="#fff">Spring</Text>
      </Box>
    </Pressable>
  );
}
```

Both hooks follow the same pattern: declare the hook with an initial value and options; bind the returned variable to a style property. The animation system runs automatically in `tick()` — no imperative start/stop calls needed.

---

## Routing

### Routes and Route

Use `<Routes>` and `<Route>` for single-window navigation between views.

```tsz
function App() {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/about" element={<AboutView />} />
      </Routes>
    </Box>
  );
}
```

Only the active route's element is visible at a time. The compiler generates display-toggle logic (`updateRoutes()`) that sets `display: none` on non-matching routes. There is no unmount/remount — nodes are always present in the tree, just hidden.

### navigate()

`navigate('/path')` switches the active route. It compiles to `router.push("/path")`.

```tsz
function HomeView() {
  return (
    <Box style={{ padding: 24 }}>
      <Text fontSize={20} color="#fff">Home</Text>
      <Pressable onPress={() => navigate('/settings')}>
        <Text fontSize={14} color="#4ec9b0">Go to Settings</Text>
      </Pressable>
    </Box>
  );
}
```

### Limits

| Limit | Value |
|---|---|
| Routes per app | 32 |

## See Also

- [Architecture](../02-architecture/index.md)
- [CLI](../09-cli/index.md)
- [Troubleshooting](../12-troubleshooting/index.md)
- [State](../05-state/index.md)
