# Keyboard Hooks TODO

## Test Story Needed

Create `storybook/src/stories/KeyboardHooksStory.tsx` that tests:

1. **`useHotkey`** — Wire up Ctrl+Z, Ctrl+Shift+S, Escape. Show which combo fired (text feedback).
2. **`useClipboard`** — Copy button that puts text on clipboard, paste button that reads it back. Show `copied` feedback state.
3. **Modifier enrichment** — An `onKeyDown` handler that displays the raw event including `ctrl`, `shift`, `alt`, `meta` booleans.
4. **TextEditor passthrough** — A TextEditor on the same page. Press Ctrl+Z while focused in it — confirm the hotkey still fires (not swallowed).

Register the story in `storybook/src/stories/index.ts`.
