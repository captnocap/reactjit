# Classifier System

JSON-driven semantic style abstractions.

## Overview

Classifiers are a design-token system for tsz. They define named styles that map to primitives (`Box`, `Text`, `Image`), providing semantic meaning to UI elements. Instead of writing inline styles everywhere, you define a vocabulary of visual tokens once and reference them throughout your app.

There are two separate classifier systems in tsz:

1. **App classifiers** — style abstractions for `.tsz` UI components (this document)
2. **Terminal classifiers** — semantic token classification for terminal output (see terminal-integration.md)

## Defining App Classifiers

Classifiers live in `_cls.tsz` (app world) or `_clsmod.tsz` (module world) files:

**style_cls.tsz:**
```tsx
classifier({
  Page: { type: 'Box', style: { flexDirection: 'column', gap: 8, padding: 12, backgroundColor: '#0d1117' } },
  Header: { type: 'Box', style: { flexDirection: 'row', padding: 12, gap: 16, backgroundColor: '#161b22' } },
  Card: { type: 'Box', style: { padding: 12, backgroundColor: '#161b22', borderRadius: 24, flexGrow: 1 } },
  Spacer: { type: 'Box', style: { flexGrow: 1 } },

  Title: { type: 'Text', fontSize: 20, color: '#e6edf3' },
  Label: { type: 'Text', fontSize: 11, color: '#6e7681' },
  Value: { type: 'Text', fontSize: 22, color: '#e6edf3' },
  ValueGreen: { type: 'Text', fontSize: 22, color: '#3fb950' },
})
```

## Using Classifiers

Reference classifiers with dot notation: `<C.ClassName>`:

```tsx
from './style_cls'

function App() {
  return (
    <C.Page>
      <C.Header>
        <C.Title>Dashboard</C.Title>
        <C.Spacer />
      </C.Header>
      <C.Card>
        <C.Label>CPU Usage</C.Label>
        <C.ValueGreen>{`${cpu}%`}</C.ValueGreen>
      </C.Card>
    </C.Page>
  );
}
```

`<C.Card>` expands to `<Box style={{ padding: 12, backgroundColor: '#161b22', borderRadius: 24, flexGrow: 1 }}>` at compile time.

## Classifier Properties

### Box classifiers
```tsx
ClassName: {
  type: 'Box',
  style: {
    // Any valid Box style props
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    // ...
  }
}
```

### Text classifiers
```tsx
ClassName: {
  type: 'Text',
  fontSize: 16,
  color: '#e2e8f0'
}
```

Text classifiers set `fontSize` and `color` at the top level (not nested in `style`).

## Compilation

Classifiers are collected in **Phase 3** (`collectClassifiers`). The compiler:

1. Scans for `classifier({...})` blocks in the merged source
2. Parses each entry's name, primitive type, and style properties
3. When `<C.ClassName>` appears in JSX (Phase 8), substitutes the classifier's properties

Classifiers are pure compile-time — no runtime lookup. They expand to the same Zig code as writing the style inline.

## Breakpoint Overrides

Classifiers can include responsive breakpoint overrides:

```tsx
classifier({
  Card: {
    type: 'Box',
    style: { padding: 16, flexDirection: 'column' },
    bp: {
      sm: { style: { padding: 8 } },
      lg: { style: { flexDirection: 'row' } },
    }
  }
})
```

## Terminal Classifiers

The terminal classifier system (`framework/classifier.zig`) is separate from app classifiers. It provides semantic token classification for terminal output:

### Built-in modes

| Mode | Tokens | Use case |
|------|--------|----------|
| `none` | — | Raw terminal, no classification |
| `basic` | 7 tokens | Generic shell output |
| `claude_code` | 25+ tokens | Claude Code CLI output |
| `json` | — | JSON-driven custom classification |

### Token types (basic)
`output`, `command`, `error`, `success`, `heading`, `separator`, `progress`

### Token types (claude_code)
All basic tokens plus: `user_prompt`, `assistant_text`, `thinking`, `tool`, `result`, `diff`, `banner`, `status_bar`, `permission`, `task_done`, `task_active`, `task_open`, and more.

Each token maps to a hardcoded color via `tokenColor()`. The classifier scans terminal row text for patterns (error keywords, prompt markers, box-drawing characters) and assigns tokens per-row.

## Known Limitations

- Max 2048 classifiers per app
- Max 64 classifiers with breakpoint overrides
- Classifier names must start with uppercase (they use the `C.` namespace)
- Only `Box` and `Text` types are supported (no `Image`, `Pressable`, etc.)
- Terminal classifiers are per-row, not per-character — one token per line
