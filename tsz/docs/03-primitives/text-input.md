---
title: TextInput
description: Single-line text field with cursor, selection, clipboard, and undo support.
category: Primitives
keywords: textinput, textarea, input, text field, form, keyboard, focus, placeholder, onChange
related: Box, Text, Events, State
difficulty: beginner
---

## Overview

`TextInput` renders a focusable text field that accepts keyboard input. Click to focus, type to enter text, Escape to unfocus. Arrow keys move the cursor, Backspace deletes, and Ctrl+A/C/X/V/Z provide selection and clipboard operations. Each `TextInput` in a component is assigned a numeric ID at compile time; use `getText(id)` to read the current value from a handler or state expression.

`TextArea` is the multiline variant. It accepts Enter to insert newlines and Tab to insert four spaces. Otherwise the API is identical to `TextInput`.

## Syntax

```tsz
function App() {
  return (
    <Box style={{ padding: 24, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 12 }}>
      <TextInput
        placeholder="Type here..."
        fontSize={16}
        color="#ffffff"
        style={{ padding: 12, backgroundColor: '#282838' }}
      />
    </Box>
  );
}
```

## Props / API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | string | `""` | Gray hint text shown when the field is empty |
| `fontSize` | number | `16` | Font size in pixels |
| `color` | `'#rrggbb'` | `"#ffffff"` | Text color |
| `style` | StyleObject | `{}` | Layout and visual properties — same set as `Box` |
| `onChangeText` | `() => void` | none | Called after every character insertion or deletion |

## Reading Input Values

Each `TextInput` is assigned an ID at compile time, counting up from `0` in declaration order. To read the current text, call `getText(id)` with the numeric ID:

```tsz
function App() {
  const [name, setName] = useState('');

  return (
    <Box style={{ padding: 24, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 12 }}>
      <TextInput
        placeholder="Your name..."
        fontSize={16}
        color="#ffffff"
        style={{ padding: 12, backgroundColor: '#282838' }}
        onChangeText={() => setName(getText(0))}
      />
      <Text fontSize={14} color="#78788c">{`Hello, ${name}`}</Text>
    </Box>
  );
}
```

The ID is determined by the order `TextInput` and `TextArea` elements appear in the component — the first is `0`, the second is `1`, and so on. Up to 32 inputs per app (compile-time limit from `input.zig`: `MAX_INPUTS = 16` in the runtime, `MAX_INPUTS = 32` in the compiler).

## Examples

### Single Field with Live Preview

```tsz
function App() {
  const [text, setText] = useState('');

  return (
    <Box style={{ width: 400, padding: 32, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 16 }}>
      <Text fontSize={22} color="#ffffff">Live Preview</Text>
      <TextInput
        placeholder="Type something..."
        fontSize={16}
        color="#ffffff"
        style={{ padding: 14, backgroundColor: '#282838' }}
        onChangeText={() => setText(getText(0))}
      />
      <Box style={{ padding: 16, backgroundColor: '#282838' }}>
        <Text fontSize={14} color="#aaaaaa">{`Preview: ${text}`}</Text>
      </Box>
    </Box>
  );
}
```

### Multiple Fields with Tab Cycling

```tsz
function App() {
  return (
    <Box style={{ width: 400, padding: 32, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 12 }}>
      <Text fontSize={22} color="#ffffff">Sign In</Text>
      <TextInput
        placeholder="Username"
        fontSize={15}
        color="#ffffff"
        style={{ padding: 12, backgroundColor: '#282838' }}
      />
      <TextInput
        placeholder="Password"
        fontSize={15}
        color="#ffffff"
        style={{ padding: 12, backgroundColor: '#282838' }}
      />
      <Pressable onPress={() => {}} style={{ padding: 14, backgroundColor: '#4ec9b0' }}>
        <Text fontSize={15} color="#ffffff">Log In</Text>
      </Pressable>
    </Box>
  );
}
```

Tab moves focus from one input to the next (wrapping around). Fields are cycled in declaration order.

### Multiline TextArea

```tsz
function App() {
  return (
    <Box style={{ width: 500, padding: 32, backgroundColor: '#1e1e2a', flexDirection: 'column', gap: 16 }}>
      <Text fontSize={22} color="#ffffff">Notes</Text>
      <TextArea
        placeholder="Start typing..."
        fontSize={14}
        color="#ffffff"
        style={{ padding: 14, height: 200, backgroundColor: '#282838' }}
      />
      <TextInput
        placeholder="Title (single-line)"
        fontSize={14}
        color="#ffffff"
        style={{ padding: 12, backgroundColor: '#282838' }}
      />
    </Box>
  );
}
```

`TextArea` inserts a newline on Enter and four spaces on Tab. Tab in a `TextInput` cycles to the next field; Tab in a `TextArea` indents.

## Keyboard Reference

| Key | Behavior |
|-----|----------|
| Any character | Insert at cursor |
| Backspace | Delete character before cursor (or delete selection) |
| Delete | Delete character after cursor |
| Left / Right | Move cursor |
| Home | Move cursor to start |
| End | Move cursor to end |
| Ctrl+A | Select all |
| Ctrl+C | Copy selection |
| Ctrl+X | Cut selection |
| Ctrl+V | Paste from clipboard |
| Ctrl+Z | Undo |
| Tab | Cycle to next input (TextInput) / indent 4 spaces (TextArea) |
| Enter | Submit (TextInput, handled externally) / insert newline (TextArea) |
| Escape | Unfocus |

## Internals

Each `TextInput` or `TextArea` element in a `.tsz` file is assigned an `input_id` at codegen time. The counter starts at `0` and increments for every `TextInput`/`TextArea` encountered. The generated Zig node has `.input_id = N` and `.placeholder = "..."` set.

At runtime, `input.zig` maintains a fixed array of `InputState` structs (one per ID), each holding a 256-byte text buffer, cursor position, selection state, and a multiline flag. SDL text input events (`SDL_TEXTINPUT`) are forwarded to `input.handleTextInput`, key events to `input.handleKey` and `input.handleCtrlKey`. Focus is managed by `input.focus(id)` (called on click) and `input.unfocus()` (Escape or click-outside).

`getText(id)` in `.tsz` source compiles to `input_mod.getText(id)` — a direct slice into the buffer, with no allocation.

## Gotchas

- IDs are assigned in source-order. If you add or remove a `TextInput` before another one, all subsequent IDs shift. Any `getText(N)` calls must be updated to match.
- The text buffer is 256 bytes. Input beyond that is silently dropped.
- `onChangeText` fires on every character, not on submit. For submit behavior, use a `Pressable` button that calls `getText(id)` in its `onPress` handler.
- `TextArea` renders in a fixed-height region. If the content grows beyond the height, use a `ScrollView` wrapper to make it scrollable.
- The undo stack is per-focused-input and resets when focus switches to a different field.

## See Also

- [Box](./box.md)
- [Pressable](./pressable.md)
- [State](../05-state/index.md)
- [Events — Keyboard](../06-events/keyboard.md)
