# Autotest

Automated UI tests that click buttons, verify text, and produce screenshot proof grids. Tests run headless — no window on your screen.

## Quick start

```bash
# Run a test
scripts/autotest d03_conditional_wrapping_map

# Output: tests/screenshots/d03_conditional_wrapping_map/20260407_184736/proof.png
```

## Writing a test

Create `tests/<cart_name>.autotest`. The cart name must match a `.tsz` file in `carts/`.

```
# Lines starting with # are comments

# Verify text exists on screen
expect "taps: 0"

# Click a button (by its text label)
click "Hide"

# Verify text is gone
reject "Buy milk"

# Click the 2nd button with this label (1-indexed)
click "+1" #2

# Verify the result
expect "B:1"
```

### Commands

| Command | What it does |
|---------|-------------|
| `expect "text"` | PASS if text is visible on screen. FAIL if not found. |
| `reject "text"` | PASS if text is NOT on screen. FAIL if still visible. |
| `click "text"` | Click the first node containing this text. PASS if found, FAIL if not. |
| `click "text" #N` | Click the Nth occurrence (1-indexed). Use when multiple buttons share a label. |
| `color "text" #rrggbb` | PASS if the node's text_color matches the hex value. |
| `bg "text" #rrggbb` | PASS if the node's background_color matches the hex value. |
| `styles before` | Take a full style snapshot of every node (padding, radius, gap, dimensions, colors). |
| `styles after` | Take another snapshot and diff against `before`. FAIL if 0 style changes detected. |
| `focus "placeholder"` | Click a TextInput node matching the placeholder/text. PASS if found. |
| `type "text"` | Type text into the currently focused TextInput. PASS if an input is focused. |
| `type "text" into "target"` | Focus the TextInput matching "target", then type "text" into it. |
| `key "ctrl+s"` | Send a key event with optional modifiers. Supports `ctrl`, `shift`, `alt` combos. |
| `clear` | Clear the currently focused TextInput. PASS if an input is focused. |
| `# comment` | Ignored. Use freely. |

### How clicks work

Clicks go through the real SDL event pipeline — same path as a human clicking. The engine does hit-testing, finds the pressable node, and runs the handler. If a button is covered, zero-size, or off-screen, the click misses just like it would for a real user.

### Settle timing

After every step, the engine waits 3 frames for the tree to rebuild, layout to run, and the GPU to render. Then it takes a screenshot. This means the screenshot always shows the actual visual state after the action.

### Disambiguation

When multiple nodes have the same text (e.g., three "+1" buttons), use `#N` to pick which one:

```
click "+1"      # clicks the 1st "+1" button
click "+1" #2   # clicks the 2nd "+1" button
click "+1" #3   # clicks the 3rd "+1" button
```

## Running tests

```bash
# Run one test
scripts/autotest d03_conditional_wrapping_map

# The proof grid lands in:
#   tests/screenshots/<name>/<timestamp>/proof.png
#
# Each run gets its own timestamped directory.
# A "latest" symlink always points to the most recent run.
# Old runs are preserved — you can diff them to see regressions.
```

## Proof grid

Each run produces a single `proof.png` image containing:

- A header with pass/fail count, source file, test script, date, and compiler/engine/source hashes
- One cell per step showing:
  - Green bar = PASS, red bar = FAIL
  - Step number and the command (e.g., `3. click "Hide"`)
  - Screenshot cropped and zoomed around the node being tested

The grid is the proof artifact. If 13/13 shows green with readable screenshots showing the correct state, the test is real. If something is wrong, you can see exactly which step failed and what the screen looked like.

## Writing strong tests

A test that only does `expect "some button"` proves nothing. It confirms a string exists — not that the app works. Follow these rules:

### 1. Test the interaction, not the label

Bad:
```
expect "Submit"
```

Good:
```
click "Submit"
expect "Account created!"
```

### 2. Verify state changes, not just existence

Bad:
```
click "+1"
expect "+1"     # the button still exists, so what?
```

Good:
```
expect "taps: 0"
click "+1"
expect "taps: 1"
click "+1"
expect "taps: 2"
```

### 3. Verify things disappear when they should

```
click "Hide"
reject "Buy milk"    # list should be gone
expect "Show"        # toggle label should have flipped
```

### 4. Test style/visual changes with `styles before/after`

If a click is supposed to change how things LOOK (variant switching, theme changes, layout shifts), checking text alone is useless. Use targeted style diffing:

```
styles before Revenue        # snapshot the Revenue node's styles
click "Compact"
styles after Revenue         # FAIL if padding/radius/gap didn't change
```

This catches the bug where the button works and the state updates but the visual styles never actually apply. Without this, a test will say PASS while the UI looks identical.

### 5. Use `color` for text color verification

If the source says `color="#3b82f6"`, verify it:
```
color "Panel A" #3b82f6
```

### 6. Use disambiguation for duplicate labels

Three "+1" buttons? Don't just click the first one:
```
click "+1"       # Panel A
click "+1" #2    # Panel B
click "+1" #3    # Panel C
```

### 7. The source audit catches missing data automatically

If the cart has a `.script.tsz` with data like `{ title: 'Revenue', value: '$12.4k' }`, the source audit verifies those strings appear at runtime. You don't need to write `expect` for every data string — the audit catches it. But you DO need explicit `expect` for conditional UI text.

## Example tests

### Simple: toggle + verify (d03)

```
expect "taps: 0"
click "[x]"
expect "taps: 1"
click "Hide"
reject "Buy milk"
click "Show"
expect "Buy milk"
```

### Multi-panel state isolation (d15)

```
click "+1"
click "+1"
click "+1"
expect "A:3 B:0 C:0"
click "+1" #2
click "+1" #2
expect "A:3 B:2 C:0"
click "Hide A"
reject "Panel A"
expect "A:3 B:2 C:0"    # hiding A doesn't reset counters
click "Show A"
expect "A:3 B:2 C:0"    # state persists across unmount
```

### Visual style verification (d121)

```
styles before Revenue
click "Compact"
styles after Revenue      # FAIL if tile styles didn't change
```

## File layout

```
tests/
  d03_conditional_wrapping_map.autotest   ← test script
  d15_unmount_remount.autotest            ← another test
  screenshots/
    d03_conditional_wrapping_map/
      latest → 20260407_184742
      20260407_184619/
        proof.png                         ← proof grid
        manifest.txt                      ← step results
        step_00.png ... step_13.png       ← individual screenshots
      20260407_184736/
        proof.png
        ...
```
