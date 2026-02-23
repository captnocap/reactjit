# Web Mode Cleanup Checklist

This document tracks the removal of all web mode code from ReactJIT. We are eliminating web mode entirely in favor of WASM builds of native code for web deployment.

## Cleanup Strategy
1. Remove all `if (mode === 'web')` branches
2. Remove all `WebComponent` helper functions
3. Remove all `document.addEventListener` calls
4. Remove all mouse/keyboard event handlers that were web-only
5. Remove all `<div>` elements and CSS-in-JS styling
6. Keep only native mode code paths
7. Remove unused imports after cleanup

---

## CRITICAL PRIORITY (Document listeners + Complex input logic)

### 1. ✅ DONE: `packages/controls/src/Knob.tsx`
- **Location**: Lines 118-241
- **Web path**: Full drag interaction with mousemove/mouseup listeners on document (lines 150-159)
- **Issue**: Computes drag deltas and calls `handleValueChange` in React
- **To Remove**:
  - `if (mode === 'web')` block (lines 118-241)
  - `isDragging`, `dragStartY` state (lines 119-120)
  - `handleMouseDown`, `handleMouseMove`, `handleMouseUp` functions (lines 125-148)
  - `useEffect` with document listeners (lines 150-159)
  - All `<div>` elements and `React.CSSProperties`
- **Keep**: Native mode only (lines 243-265)

### 2. ✅ DONE: `packages/controls/src/Fader.tsx`
- **Location**: Lines 83-197
- **Web path**: Drag to position-to-value computation with document listeners (lines 113-122)
- **Issue**: Computes position and calls `handleValueChange` on mousemove
- **To Remove**:
  - `if (mode === 'web')` block (lines 83-197)
  - `isDragging` state, `trackRef` (lines 84-85)
  - `handleMouseDown`, `handleMouseMove`, `handleMouseUp` functions (lines 87-111)
  - `useEffect` with document listeners (lines 113-122)
  - All track/thumb DOM rendering
- **Keep**: Native mode only (lines 199-223)

### 3. ✅ DONE: `packages/core/src/Select.tsx`
- **Location**: Lines 114-191
- **Web path**: Click-outside detection + hover tracking + manual dropdown rendering
- **Issue**: Manages `isOpen`, `hoveredIndex` in React; document listener for clicks (lines 69-79)
- **To Remove**:
  - `if (mode === 'web')` block (lines 114-191)
  - `containerRef` and click-outside `useEffect` (lines 68-79)
  - `hoveredIndex` state (line 46)
  - `handleToggle` function (lines 61-65)
  - All trigger and floating panel DOM rendering
  - `onMouseEnter`/`onMouseLeave` handlers (lines 155-156)
- **Keep**: Native mode only (lines 193-214)

### 4. ✅ DONE: `packages/core/src/Modal.tsx`
- **Location**: Lines 145-205
- **Web path**: CSS transitions, animation timing with `setInterval`, Escape key handling, body scroll prevention
- **Issue**: Lines 63-103 have complex animation state with timers; lines 112-120 have Escape listener; lines 122-128 mutate document.body.style
- **To Remove**:
  - Entire animation state machine (lines 57-110)
  - `previousVisibleRef`, `onShowCalledRef` refs
  - `useEffect` with keyboard listener (lines 112-120)
  - `useEffect` with body overflow mutation (lines 122-128)
  - `if (mode === 'web')` web rendering (lines 145-205)
  - All CSS transitions and opacity/transform calculations
- **Keep**: Native mode only (lines 218-257)

### 5. ✅ DONE: `packages/core/src/ContextMenu.tsx`
- **Location**: Lines 20-139
- **Web path**: Click-outside listener (57-63), Escape key listener (66-76), direct DOM style mutation on hover (121-129)
- **Issue**: Multiple document listeners and imperative DOM style manipulation
- **To Remove**:
  - `if (mode === 'web')` block (lines 114-191)
  - `menuState` and position tracking state (lines 27-28)
  - `handleContextMenu`, `handleItemClick`, `handleClickOutside` functions
  - TWO `useEffect` blocks with document listeners (lines 57-76)
  - All menu rendering with direct `(e.target as HTMLElement).style.background` mutations (lines 121-129)
  - `onContextMenu` handler
- **Keep**: Native mode only (lines 143-185)

### 6. ✅ DONE: `packages/core/src/ImageViewerModal.tsx`
- **Location**: Lines 140-159
- **Web path**: Keyboard navigation with arrow keys, Home, End (document listener)
- **Issue**: Computes image navigation based on key input in React
- **To Remove**:
  - `useEffect` with keyboard listener (lines 140-159)
  - `onNativeKeyDown` function (lines 132-138)
  - Web-specific keydown handling logic
- **Keep**: Just the native `onKeyDown` handler on Box (line 179)
- **Note**: This is already mostly native-correct, just clean up web path

### 7. ✅ PENDING: `packages/core/src/Slider.tsx`
- **Location**: Unknown - need to check this file
- **Web path**: Has document.addEventListener
- **To Remove**: All web mode code and listeners

---

## HIGH PRIORITY (Input state management)

### 8. ✅ PENDING: `packages/core/src/ScrollView.tsx`
- **Location**: Lines 34-146 (WebScrollView)
- **Web path**: Scroll event handling with state tracking
- **Issue**: `handleScroll` computes visible range and manages debouncing
- **To Remove**:
  - `WebScrollView` component entirely (lines 34-146)
  - `isScrollingRef`, `scrollEndTimerRef` refs
  - `handleScroll` function with event computation
  - `useEffect` with cleanup for debounce timer
- **Keep**: NativeScrollView (lines 150-213)

### 9. ✅ PENDING: `packages/core/src/TextInput.tsx`
- **Location**: Lines 23-138
- **Web path**: `WebTextInput` with input/textarea handling
- **Issue**: `handleChange`, `handleKeyDown` compute values in React
- **To Remove**:
  - `WebTextInput` function entirely (lines 23-138)
  - `handleBlur`, `handleKeyDown`, `handleChange` functions
  - All input/textarea DOM rendering
- **Keep**: NativeTextInput (lines 142-246)

### 10. ✅ PENDING: `packages/core/src/TextEditor.tsx`
- **Location**: Lines 21-108
- **Web path**: `WebTextEditor` with textarea handling
- **Issue**: Manages text state in React
- **To Remove**:
  - `WebTextEditor` function entirely (lines 21-108)
  - `handleBlur`, `handleKeyDown`, `handleChange` functions
  - `internalValue` state
  - All textarea DOM rendering
- **Keep**: NativeTextEditor (lines 112-222)

### 11. ✅ PENDING: `packages/core/src/Pressable.tsx`
- **Location**: Multiple web-specific paths
- **Web path**: Lines 253-313 - full web implementation with div handlers
- **Issue**: Interaction state machine in React with long-press timer
- **To Remove**:
  - Web mode path (lines 253-313)
  - All `<div>` rendering with mouse handlers
  - `onMouseUp` handler (line 302)
  - `onPointerEnter`/`onPointerLeave` handlers in web
- **Keep**: Native mode only (lines 204-251)
- **Note**: Long-press timer logic (95-163) is ALSO a problem but exists in both modes

### 12. ✅ PENDING: `packages/core/src/Checkbox.tsx`
- **Location**: Lines 53-97
- **Web path**: Full web implementation with `<div>` and click handler
- **Issue**: Manages toggle state in React
- **To Remove**:
  - `if (mode === 'web')` block (lines 53-97)
  - All `<div>` elements and CSS styling
  - `onClick={disabled ? undefined : handleToggle}` handler in web
- **Keep**: Native mode only (lines 99-123)

### 13. ✅ PENDING: `packages/core/src/Radio.tsx`
- **Location**: Lines 57-153
- **Web path**: Two separate implementations for RadioGroup (web div) and Radio (web div)
- **Issue**: Multiple web/native branches
- **To Remove**:
  - RadioGroup web path (lines 57-64)
  - Radio web path (lines 111-152)
  - All `<div>` elements and click handlers
- **Keep**: Native mode only

### 14. ✅ PENDING: `packages/core/src/Switch.tsx`
- **Location**: Lines 94-114
- **Web path**: Full web implementation with `<div>` and click handler
- **Issue**: Manages toggle state in React
- **To Remove**:
  - `if (mode === 'web')` block (lines 94-114)
  - All `<div>` and nested `<div>` rendering
  - `onClick` handler
  - CSS transition
- **Keep**: Native mode only (lines 117-135)

### 15. ✅ PENDING: `packages/core/src/primitives.tsx`
- **Location**: THREE web branches
  1. Box (lines 355-372) - web `<div>` rendering
  2. Text (lines 513-545) - web `<span>` rendering
  3. Image (lines 556-580) - web `<img>` rendering
- **Issue**: Each primitive has full web DOM implementation
- **To Remove**:
  - All three `if (mode === 'web')` blocks
  - All `<div>`, `<span>`, `<img>` elements
  - All `React.CSSProperties` conversions
  - `styleToCSS` usage where possible
- **Keep**: Native paths only

### 16. ✅ PENDING: `packages/controls/src/PadButton.tsx`
- **Location**: Lines 36-76
- **Web path**: `<div>` with onMouseDown/onMouseUp/onMouseLeave handlers
- **Issue**: Web mode has mouse event handlers
- **To Remove**:
  - `if (mode === 'web')` block (lines 36-76)
  - All `<div>` rendering
  - `onMouseDown`, `onMouseUp`, `onMouseLeave` handlers
- **Keep**: Native mode only (lines 80-115)

---

## MEDIUM PRIORITY (Simple returns/fallbacks)

### 17. ✅ PENDING: `packages/3d/src/DirectionalLight.tsx`
- **Remove**: `if (mode === 'web') return null;`

### 18. ✅ PENDING: `packages/3d/src/Mesh.tsx`
- **Remove**: `if (mode === 'web') return null;`

### 19. ✅ PENDING: `packages/3d/src/Scene.tsx`
- **Remove**: Web path (lines 19-80)

### 20. ✅ PENDING: `packages/3d/src/AmbientLight.tsx`
- **Remove**: `if (mode === 'web') return null;`

### 21. ✅ PENDING: `packages/3d/src/Camera.tsx`
- **Remove**: `if (mode === 'web') return null;`

### 22. ✅ PENDING: `packages/geo/src/Marker.tsx`
- **Remove**: Web path (lines 21-34)

### 23. ✅ PENDING: `packages/geo/src/Polyline.tsx`
- **Remove**: Web path (lines 21-38)

### 24. ✅ PENDING: `packages/geo/src/Map.tsx`
- **Remove**: Web path (lines 33-78)

### 25. ✅ PENDING: `packages/geo/src/TileLayer.tsx`
- **Remove**: Web path (lines 25-38)

### 26. ✅ PENDING: `packages/geo/src/Polygon.tsx`
- **Remove**: Web path (lines 20-33)

### 27. ✅ PENDING: `packages/geo/src/GeoJSON.tsx`
- **Remove**: Web path (lines 16-27)

### 28. ✅ PENDING: `packages/core/src/Portal.tsx`
- **Remove**: `WebFallbackPortal` component (lines 80-95)
- **Remove**: Web fallback logic in Portal component

### 29. ✅ PENDING: `packages/core/src/Native.tsx`
- **Remove**: `if (mode === 'web') return null;`

### 30. ✅ PENDING: `packages/core/src/Emulator.tsx`
- **Remove**: `if (mode === 'web') return null;`

### 31. ✅ PENDING: `packages/core/src/VideoPlayer.tsx`
- **Location**: Lines 57+
- **Remove**: Web path

### 32. ✅ PENDING: `packages/core/src/Video.tsx`
- **Location**: Lines 55+
- **Remove**: Web path

### 33. ✅ PENDING: `packages/controls/src/Meter.tsx`
- **Remove**: Two `if (mode === 'web')` blocks

### 34. ✅ PENDING: `packages/controls/src/LEDIndicator.tsx`
- **Remove**: `if (mode === 'web')` block

### 35. ✅ PENDING: `packages/core/src/CodeBlock.tsx`
- **Remove**: `WebCodeBlock` function entirely
- **Keep**: Native mode only

---

## Cleanup Order

**Session 1 (CRITICAL):**
1. Knob.tsx
2. Fader.tsx
3. Select.tsx
4. Modal.tsx
5. ContextMenu.tsx

**Session 2 (CRITICAL continued):**
6. ImageViewerModal.tsx
7. Slider.tsx (need to check this file)

**Session 3 (HIGH):**
8. ScrollView.tsx
9. TextInput.tsx
10. TextEditor.tsx
11. Pressable.tsx (has long-press timer to address later)

**Session 4 (HIGH continued):**
12. Checkbox.tsx
13. Radio.tsx
14. Switch.tsx
15. primitives.tsx (3 branches!)
16. PadButton.tsx
17. CodeBlock.tsx

**Session 5 (MEDIUM):**
18-34. All 3D, Geo, Portal, Native, Emulator, VideoPlayer, Video, Meter, LEDIndicator

---

## Notes

- After all web mode is removed, we tackle the input behavior problems (long-press timers, state computation, etc.) one by one
- This is a structural cleanup pass
- Next pass will be behavior cleanup on the native side
- Files may need `useRendererMode()` import removed if no longer used
- Some files may be completely rewritten (Portal, TextInput, TextEditor)

