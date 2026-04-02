# Cart Structure

How to organize a tsz application.

## Overview

A "cart" (cartridge) is a self-contained tsz application. Carts live in `tsz/carts/` as directories containing a `.tsz` entry point and optional supporting files. Each cart compiles to either a standalone binary or a hot-reloadable `.so`.

## File Extensions

tsz has 7 file kinds split into two isolated worlds:

### App World (for standalone apps)

| Extension | Purpose | Example |
|-----------|---------|---------|
| `.tsz` | App entry point — contains `function App()` | `counter.tsz` |
| `_c.tsz` | Component file — reusable UI components | `StatCard_c.tsz` |
| `_cls.tsz` | Classifier file — semantic style tokens | `style_cls.tsz` |
| `_script.tsz` | Script file — JavaScript logic for QuickJS | `metrics_script.tsz` |

### Module World (for framework runtime modules)

| Extension | Purpose | Example |
|-----------|---------|---------|
| `.mod.tsz` | Module entry point — compiles to `.gen.zig` | `state.mod.tsz` |
| `_cmod.tsz` | Module component file | `DetailSection_cmod.tsz` |
| `_clsmod.tsz` | Module classifier file | `style_clsmod.tsz` |

### Special

| Extension | Purpose | Example |
|-----------|---------|---------|
| `_zscript.tsz` | Imperative Zig module (no JSX) | `physics_zscript.tsz` |

### Legacy (still supported)

`.c.tsz` → `_c.tsz`, `.cls.tsz` → `_cls.tsz`, `.script.tsz` → `_script.tsz`

## Minimal Cart

The simplest possible cart is a single `.tsz` file:

**hello.tsz:**
```tsx
function App() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e', padding: 20 }}>
      <Text style={{ fontSize: 32, color: '#e2e8f0' }}>Hello, World!</Text>
    </Box>
  );
}
```

Build and run:
```bash
bin/tsz build carts/hello/hello.tsz
./tsz/zig-out/bin/hello
```

## Typical Cart Layout

```
carts/dashboard/
  dashboard.tsz              # Entry point (function App + useState + JSX)
  StatCard_c.tsz             # Component: stat display card
  MetricRow_c.tsz            # Component: metric row with label + value
  style_cls.tsz              # Classifiers: Page, Header, Card, Title, Value, etc.
  metrics_script.tsz         # JS logic: polling, timers, data generation
```

## Import Graph

The entry point imports supporting files:

```tsx
// dashboard.tsz
from './StatCard_c'           // imports StatCard_c.tsz
from './MetricRow_c'          // imports MetricRow_c.tsz
from './style_cls'            // imports style_cls.tsz
from './metrics_script'       // imports metrics_script.tsz (JS, handled separately)

function App() {
  const [cpu, setCpu] = useState(45);
  return (
    <C.Page>
      <C.Header><C.Title>Dashboard</C.Title></C.Header>
      <StatCard title="CPU" value={`${cpu}%`} />
    </C.Page>
  );
}
```

### Resolution rules

1. `from './name'` tries extensions in order: `.tsz`, `_c.tsz`, `_cls.tsz`, `_script.tsz`, `.mod.tsz`, `_cmod.tsz`, `_clsmod.tsz`
2. Explicit suffixes work: `from './style_cls'` resolves to `style_cls.tsz`
3. `_script.tsz` imports are loaded as JS (not merged into Zig source)
4. All other imports are textually merged (inlined) before codegen

### Import boundaries

- App world (`.tsz`) can import: `_c.tsz`, `_cls.tsz`, `_script.tsz`
- Module world (`.mod.tsz`) can import: `_cmod.tsz`, `_clsmod.tsz`, `_script.tsz`
- Cross-world imports are rejected at compile time
- `_c.tsz` and `_cmod.tsz` cannot import `_script.tsz` (only entry points can)

## Entry Point Structure

Every app entry point follows this pattern:

```tsx
// 1. Imports (optional)
from './components_c'
from './style_cls'
from './logic_script'

// 2. FFI pragmas (optional)
// @ffi <time.h> -lrt
declare function getTime(): number

// 3. Component definitions (optional)
function MyComponent({ prop1, prop2 }) {
  return <Box>...</Box>;
}

// 4. Utility functions (optional)
function formatValue(val) {
  return `${val}%`;
}

// 5. App function (required)
function App() {
  // State hooks
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState("Hello");

  // FFI hooks
  const [uptime] = useFFI(getTime, 1000);

  // Animation hooks
  useTransition(opacity, target, 300, "easeOut");

  // Let variables
  let threshold = 50;

  // Return JSX
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Text>{`Count: ${count}`}</Text>
    </Box>
  );
}
```

## Real-World Examples

### Counter (minimal state)
```
carts/hotreload-test/counter.tsz    # Single file, useState + onPress
```

### Dashboard (multi-file)
```
carts/dashboard/
  dashboard.tsz                          # App with 15+ state hooks
  StatCard_c.tsz, MetricRow_c.tsz       # Components
  style_cls.tsz                          # 20+ classifiers
  metrics_script.tsz                     # JS timers for mock data
```

### Inspector (complex app)
```
carts/inspector/
  inspector.tsz                          # Multi-tab dev tools
  ElementsPage_c.tsz                     # DOM tree inspector
  PerfPage_c.tsz                         # Performance dashboard
  ConsolePage_c.tsz                      # Console output
  NetworkPage_c.tsz                      # Network inspector
  SourcePage_c.tsz                       # Source code viewer
  WireframePage_c.tsz                    # Wireframe overlay
  style_cls.tsz                          # Inspector-specific classifiers
  telemetry_script.tsz                   # JS for live telemetry polling
  graph_script.tsz                       # JS for constraint graph data
```

### Charts (library of chart types)
```
carts/charts/
  line_chart.tsz
  bar_chart.tsz
  pie_chart.tsz
  donut_chart.tsz
  radar_chart.tsz
  candlestick_chart.tsz
  area_chart.tsz
  charts_cls.tsz                         # Shared chart classifiers
```

## Building Carts

```bash
# Full binary (production)
bin/tsz build carts/dashboard/dashboard.tsz

# Dev mode (hot-reload, 63x faster iteration)
bin/tsz dev carts/dashboard/dashboard.tsz

# Preflight check (validates without building)
bin/tsz check carts/dashboard/dashboard.tsz

# Lint only
bin/tsz lint carts/dashboard/dashboard.tsz
```

## Known Limitations

- Max 32 imports per file
- All files in a cart must be in the same directory (no subdirectory imports)
- `.tsz` is a legacy naming convention — plain `.tsz` is preferred for entry points
- Cart directories have no manifest file — the entry point `.tsz` file IS the manifest
- File length limit: 1600 lines per `.zig` or `.tsz` file (enforced by build)
