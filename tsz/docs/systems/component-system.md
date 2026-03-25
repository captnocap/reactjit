# Component System

Function components with compile-time inlining.

## Overview

Components in tsz are function components that look like React but compile completely differently. There is no runtime component concept — components are **inlined at compile time**. When you write `<MyButton label="hello" />`, the compiler substitutes the component's template with the prop values resolved, producing flat Zig node declarations.

## Defining Components

Components are uppercase-named functions that take a destructured props object and return JSX:

```tsx
function StatusCard({ title, value, color }) {
  return (
    <Box style={{ padding: 12, backgroundColor: '#1e293b', borderRadius: 8 }}>
      <Text style={{ fontSize: 11, color: '#94a3b8' }}>{title}</Text>
      <Text style={{ fontSize: 22, color: color }}>{value}</Text>
    </Box>
  );
}
```

## Using Components

```tsx
function App() {
  const [cpu, setCpu] = useState(45);
  return (
    <Box>
      <StatusCard title="CPU" value={`${cpu}%`} color="#60a5fa" />
      <StatusCard title="Memory" value="3.2 GB" color="#4ade80" />
    </Box>
  );
}
```

## Prop Types

Props are resolved at compile time based on their syntax:

| Syntax | Type | Example |
|--------|------|---------|
| `prop="string"` | Static string | `title="CPU"` |
| `prop={expr}` | Expression | `count={state + 1}` |
| `prop={`template`}` | Dynamic text | `` value={`${cpu}%`} `` |
| `onEvent={() => {...}}` | Event handler | `onPress={() => { setCount(count + 1) }}` |

## Children

Components can accept children via the `{children}` splice:

```tsx
function Card({ title, children }) {
  return (
    <Box style={{ padding: 16, backgroundColor: '#1e293b' }}>
      <Text style={{ fontSize: 16 }}>{title}</Text>
      {children}
    </Box>
  );
}

// Usage:
<Card title="Settings">
  <Text>Content goes here</Text>
  <Pressable onPress={() => { save() }}>
    <Text>Save</Text>
  </Pressable>
</Card>
```

## Fragments

Fragments (`<>...</>`) group multiple elements without a wrapper node:

```tsx
function InfoPair({ label, value }) {
  return (
    <>
      <Text style={{ fontSize: 11, color: '#94a3b8' }}>{label}</Text>
      <Text style={{ fontSize: 16, color: '#e2e8f0' }}>{value}</Text>
    </>
  );
}
```

## File Organization

Components live in `_c.tsz` (app world) or `_cmod.tsz` (module world) files:

```
carts/dashboard/
  dashboard.tsz          # App entry point (function App)
  StatCard_c.tsz         # Component file
  MetricRow_c.tsz        # Component file
  style_cls.tsz          # Classifiers
  metrics_script.tsz     # JS logic
```

Import components with:
```tsx
from './StatCard_c'
from './MetricRow_c'
```

## Compile-Time Inlining

Components are not runtime objects. The compiler:

1. **Phase 4**: Scans for component definitions and records their body position and props
2. **Phase 7**: Counts how many times each component is used
3. **Phase 8**: At each `<MyComp>` call site, saves/restores the token position, pushes prop values onto a substitution stack, and parses the component body as if it were inline

### Multi-use optimization

Components used 2+ times that are leaf nodes (no children, no state props) get optimized into init functions (`_initMyComp(...)`) to avoid code duplication in the generated Zig.

### Recursion prevention

Self-recursive components emit `.{}` (empty node) instead of infinite recursion. Maximum inline depth is 64.

## Utility Functions

Lowercase functions are collected as utility functions (Phase 4.5) and compiled to real Zig functions:

```tsx
function formatPercent(value) {
  return `${value}%`;
}

function App() {
  return <Text>{formatPercent(cpu)}</Text>;
}
```

## Known Limitations

- No component state — components don't have their own `useState`. State lives in the App function
- No lifecycle hooks per component — `useEffect` is App-level only
- Max 64 component definitions, 128 instances, 64 props per component
- Components must be defined before they're used (top-down ordering in the merged source)
- Recursive components compile but emit empty nodes
