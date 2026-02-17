# TODO: Inspector JSX Tree View — Read the Tree Like Source Code

## Vision

The F12 inspector tree should look like reading JSX. Not a generic node dump — actual opening tags, closing tags, props inline, text content visible. You look at the inspector and you see your component tree the way you wrote it.

**Current display:**
```
v <App>  800x600
  v <Sidebar>  200x600
      View  200x40
      View  200x40
  v View  600x600
      <Header>  600x48
      View  600x552
```

**Target display:**
```
v View:<App>
  v View:<Sidebar style={{ width: 200 }}>
      View:<NavItem>Home</NavItem>
      View:<NavItem>Settings</NavItem>
    </Sidebar>
  v View:<ContentArea>
      View:<Header>
        Text:"My App"
      </Header>
      View  600x552
    </ContentArea>
  </App>
```

The tree reads like JSX. You see the component name, the element type, key props, text content, and explicit closing tags that visually bracket the children. No more counting indentation levels to figure out where a container ends.

## How it works

### Line types

Every node in the tree produces **one or two lines**: an opening tag, and optionally a closing tag after all children.

#### 1. Opening tag (always shown)

Format: `TYPE:<ComponentName prop="value">`

```
View:<App>                              -- View node, debugName "App", has children
Text:<Title>                            -- Text node, debugName "Title", has children
View:<Box style={{ flexDirection: 'row' }}>  -- View node, no debugName, key style shown
Image:<Avatar src="me.png" />           -- Image node, self-closing (no children)
__TEXT__:"Hello World"                  -- Raw text node, content shown in quotes
```

Rules:
- **Type prefix** is the Lua node type: `View`, `Text`, `Image`, `Video`, `TextInput`, `TextEditor`, `CodeBlock`, `__TEXT__`
- **Component name** is `node.debugName` if present. If not, fall back to a mapped primitive name (see mapping table below)
- **Inline props** show 1-3 of the most useful props (configurable, see below)
- **Self-closing** (`/>`) for nodes with zero children
- **Open** (`>`) for nodes with children

#### 2. Closing tag (only for nodes with children)

Format: `</ComponentName>`

```
  </App>
  </Sidebar>
  </Title>
```

Shown at the same indentation as the opening tag, after all children. Only rendered when the node is **expanded** (not collapsed). When collapsed, the opening tag shows as self-closing with an indicator:

```
> View:<App> ...                    -- collapsed, has 12 children
```

#### 3. Raw text nodes

Format: `__TEXT__:"content"`

```
__TEXT__:"Hello World"
__TEXT__:"Click me"
__TEXT__:"Score: 1250"
```

Text content is shown in quotes, truncated to ~40 characters with ellipsis if long:
```
__TEXT__:"This is a very long paragraph that..."
```

#### 4. Text containers with single text child (common case)

When a `Text` node has exactly one `__TEXT__` child, collapse them into one line:

```
-- Instead of:
v Text:<Label>
    __TEXT__:"Settings"
  </Label>

-- Show:
  Text:<Label>"Settings"</Label>
```

This is the most common pattern (`<Text>some string</Text>`) and it shouldn't take 3 lines.

### Type → primitive name mapping

On the Lua side, `<Box>` becomes `type = "View"` and `<Text>` becomes `type = "Text"`. When there's no `debugName`, we want to show the JSX primitive name, not the internal type. Mapping:

```lua
local TYPE_TO_PRIMITIVE = {
  View       = "Box",
  Text       = "Text",
  Image      = "Image",
  Video      = "Video",
  VideoPlayer= "VideoPlayer",
  TextInput  = "TextInput",
  TextEditor = "TextEditor",
  CodeBlock  = "CodeBlock",
  __TEXT__   = nil,  -- handled specially, no tag
}
```

When `debugName` exists, the type prefix is the raw type (`View:`) and the tag uses the component name (`<App>`). When `debugName` is nil, the tag uses the primitive name:

```
View:<App>          -- has debugName "App"
View:<Box>          -- no debugName, type "View" → "Box"
Text:<Text>         -- no debugName, type "Text" → "Text"
Image:<Image>       -- no debugName, type "Image" → "Image"
```

### Inline props — what to show

Showing every prop would be noisy. Show a curated set of the most useful ones:

**Always show if present:**
- `key` — React key (helps identify list items)
- `style.width` / `style.height` — if explicit (not auto-sized)
- `style.flexDirection` — if `"row"` (column is default, not interesting)
- `style.backgroundColor` — color swatch + value
- `src` — for Image/Video (truncated filename)
- `text` / `placeholder` — for TextInput

**Show on hover tooltip (not inline):**
- Full style object
- Event handlers (as `onPress`, `onHover`, etc. — just the names)
- Computed layout (x, y, w, h)

**Configurable:** A settings toggle in the inspector to control prop verbosity:
- **Minimal** — just component names and closing tags
- **Standard** — names + key props (default)
- **Verbose** — names + all non-default style props

### Indentation and visual structure

```
v View:<App>                           ← depth 0
│ v View:<Sidebar style={{ width: 200 }}>  ← depth 1
│ │   View:<NavItem>"Home"</NavItem>       ← depth 2
│ │   View:<NavItem>"Settings"</NavItem>
│ │ </Sidebar>                             ← closing at depth 1
│ v View:<ContentArea>
│ │   Text:<Header>"My App"</Header>
│ │   View:<ScrollView style={{ height: '100%' }}>
│ │   │ ...                                ← collapsed children
│ │   </ScrollView>
│ │ </ContentArea>
│ </App>                                   ← closing at depth 0
```

- **Guide lines** (`│`) connect opening to closing tag — makes the hierarchy instantly scannable
- **Collapse arrow** (`v` / `>`) only on opening tags that have children
- **Closing tags** are dimmer than opening tags (lower opacity/muted color)
- **Indentation** per depth level: 16px (wider than current 12px, to accommodate the visual structure)

### Color coding

| Element | Color |
|---------|-------|
| Type prefix (`View:`, `Text:`) | Dim/muted — secondary info |
| Tag brackets (`<`, `>`, `</`, `/>`) | Muted grey |
| Component name (`App`, `Sidebar`) | Accent color (current: blue/purple) |
| Primitive name (`Box`, `Text`) | Slightly different accent (teal/cyan) |
| Props (`style=`, `src=`) | Yellow/gold |
| Prop values (`200`, `"row"`) | Green |
| Text content (`"Hello"`) | Orange/peach |
| Closing tags | Same as opening but lower opacity |
| Guide lines | Very dim border color |
| Dimensions (when shown) | Grey |

This matches how JSX looks in a code editor with syntax highlighting. The inspector *is* a code viewer — it should feel like one.

---

## Implementation

### Changes to `lua/inspector.lua`

The core change is rewriting `drawTreeNode()` (currently at line 855). It currently draws one line per node. The new version draws:

1. **Opening tag line** — with type prefix, component/primitive name, inline props
2. **Children** (recursively) — indented one level deeper
3. **Closing tag line** — matching the opening tag

```lua
-- Pseudocode for new drawTreeNode
function drawTreeNode(node, depth, region, y)
  -- 1. Build the opening tag string
  local typeName = node.type
  local tagName = node.debugName or TYPE_TO_PRIMITIVE[typeName] or typeName
  local isTextNode = (typeName == "__TEXT__")
  local isSelfClosing = (#node.children == 0)
  local isCollapsed = state.collapsed[node.id]
  local isSingleTextChild = (#node.children == 1 and node.children[1].type == "__TEXT__")

  -- 2. Draw opening line
  if isTextNode then
    -- __TEXT__:"content"
    drawTextNodeLine(node, depth, y)
  elseif isSingleTextChild and isSelfClosing == false then
    -- Inline: Text:<Label>"content"</Label>
    drawInlineTextLine(node, tagName, typeName, depth, y)
  elseif isSelfClosing or isCollapsed then
    -- Self-closing or collapsed: View:<App /> or > View:<App> ...
    drawSelfClosingLine(node, tagName, typeName, depth, y, isCollapsed)
  else
    -- Opening: View:<App prop="val">
    drawOpeningTagLine(node, tagName, typeName, depth, y)
  end
  y = y + lineHeight

  -- 3. Draw children (if expanded and has children)
  if not isSelfClosing and not isCollapsed and not isSingleTextChild then
    for _, child in ipairs(node.children) do
      y = drawTreeNode(child, depth + 1, region, y)
    end

    -- 4. Draw closing tag
    drawClosingTagLine(tagName, typeName, depth, y)
    y = y + lineHeight
  end

  return y
end
```

### Passing the original JSX name through the bridge

Currently `<Box>` becomes `createElement("View", ...)` in primitives.tsx, so the Lua side only sees `"View"`. We have two options:

**Option A: Static mapping in Lua (simpler, no bridge changes)**

```lua
local TYPE_TO_PRIMITIVE = { View = "Box", Text = "Text", Image = "Image", ... }
```

Downside: custom components that render as raw `createElement("View")` will show as `Box` even if they're not Box. But this is rare — almost no one calls `createElement` directly.

**Option B: Send the JSX element name through the bridge (more accurate)**

In `hostConfig.ts`, the `CREATE` command already sends `type` and `debugName`. We could add a `primitiveName` field:

```typescript
// In hostConfig.ts createInstance:
commands.push({
  op: OpCode.CREATE,
  id: inst.id,
  type,                          // "View", "Text", etc.
  primitiveName: "Box",          // the JSX-level name
  debugName: componentName,      // the React component name
  // ...
});
```

Then in `primitives.tsx`, each component would set this on the element:

```tsx
function Box(props) {
  return createElement('View', { ...resolvedProps, __primitiveName: 'Box' });
}
```

And `hostConfig.ts` would read `props.__primitiveName` and include it in the CREATE command.

**Recommendation: Start with Option A** (zero bridge changes, works today). Graduate to Option B only if the static mapping proves insufficient. The mapping table is 8 entries and covers every primitive.

### Closing tag tracking

The current `drawTreeNode` is recursive and handles its own children, so the closing tag is naturally placed at the right position. The main challenge is **scrolling** — the tree is rendered in a scrollable region, and we need to know the total height including closing tags.

Current height calculation (inspector.lua line ~910-920) counts one line per node. New calculation must account for closing tags:

```lua
function countTreeLines(node)
  if node.type == "__TEXT__" then return 1 end
  if #node.children == 0 then return 1 end  -- self-closing
  if #node.children == 1 and node.children[1].type == "__TEXT__" then return 1 end  -- inline text
  if state.collapsed[node.id] then return 1 end  -- collapsed

  local lines = 1  -- opening tag
  for _, child in ipairs(node.children) do
    lines = lines + countTreeLines(child)
  end
  lines = lines + 1  -- closing tag
  return lines
end
```

### Guide lines

Vertical guide lines connecting opening tag to closing tag:

```lua
function drawGuideLine(depth, fromY, toY, region)
  local x = region.x + pad + depth * indentSize + indentSize / 2
  love.graphics.setColor(guideLineColor)
  love.graphics.line(x, fromY, x, toY)
end
```

Track the Y position where each opening tag was drawn, then when drawing the closing tag, draw a line from opening Y to closing Y at the appropriate depth.

---

## Interaction changes

### Click behavior

- **Click opening tag** → select that node (highlight in viewport, show detail panel)
- **Click closing tag** → select the same node as the opening tag
- **Click collapse arrow** → toggle expand/collapse
- **Double-click opening tag** → scroll viewport to center that node

### Hover behavior

- **Hover opening or closing tag** → highlight the node in the viewport (existing behavior)
- **Hover type prefix** → tooltip showing the full type and any type-specific info
- **Hover component name** → tooltip showing source file + line number
- **Hover prop value** → tooltip showing the full value (useful for truncated values)

### Keyboard

- **Up/Down arrows** → navigate nodes (skip closing tags — they share selection with opening)
- **Left arrow** → collapse current node (or go to parent if already collapsed)
- **Right arrow** → expand current node (or go to first child if already expanded)
- **Enter** → scroll viewport to selected node

---

## Edge cases

### Deep nesting

Very deep trees (10+ levels) will push content off the right edge of the panel. Solutions:
- Horizontal scrolling in the tree panel
- Or: at depth > 8, reduce indentation to 8px per level
- Or: truncate long tag names at depth > 6

### Very long prop strings

`style={{ width: '100%', height: '100%', flexDirection: 'row', backgroundColor: '#1e1e2e', padding: 12 }}` is too long for one line.

Solution: show only the 2-3 most distinctive props inline. The rest go in the detail panel. Priority order:
1. `key` (always first if present)
2. `style.flexDirection` (if `"row"`)
3. `style.width` / `style.height` (if explicit)
4. `src` / `placeholder` / `value` (element-specific)

### Nodes without debugName or meaningful type

Anonymous wrappers (`<Box><Box><Box>...</Box></Box></Box>`) would show as:
```
View:<Box>
  View:<Box>
    View:<Box>
```

This is still more readable than the current format because the closing tags tell you where each ends. But we could also show computed dimensions on anonymous nodes to help identify them:

```
View:<Box 800x600>
  View:<Box 200x600>
    View:<Box 200x40>
    </Box>
  </Box>
</Box>
```

### Empty text nodes

Sometimes React inserts empty text nodes (`__TEXT__:""`) between elements. These should be hidden by default (clutter reduction) with a toggle to show them.

---

## Performance

The tree can have hundreds of nodes. Closing tags double the line count in the worst case (fully expanded tree). Mitigations:

1. **Virtualized rendering** — only draw lines visible in the scroll region (current inspector already clips to the panel region, but doesn't skip calculation). Calculate total height, then only call draw functions for lines whose Y falls within the visible range.

2. **Cache tag strings** — the formatted opening/closing tag strings only change when props change. Cache them on the node and invalidate on prop updates.

3. **Lazy line counting** — don't recount the full tree every frame. Recount only when collapse state changes or the tree structure changes (mutation from React).

---

## Files to modify

| File | Change |
|------|--------|
| `lua/inspector.lua` | Rewrite `drawTreeNode()` for JSX format, add closing tags, guide lines, color coding |
| `lua/inspector.lua` | Update `countTreeLines()` / height calculation to account for closing tags |
| `lua/inspector.lua` | Add `TYPE_TO_PRIMITIVE` mapping table |
| `lua/inspector.lua` | Update click hit detection to handle closing tag lines |
| `lua/inspector.lua` | Update hover behavior for new line types |
| `lua/tree.lua` | (Optional, Phase 2) Forward `__primitiveName` from bridge if we go with Option B |
| `packages/native/src/hostConfig.ts` | (Optional, Phase 2) Send `primitiveName` in CREATE command |
| `packages/shared/src/primitives.tsx` | (Optional, Phase 2) Set `__primitiveName` prop on each primitive |

## Build order

### Phase 1 — JSX display (core feature)
1. Add `TYPE_TO_PRIMITIVE` mapping table
2. Rewrite `drawTreeNode()` with opening/closing tag format
3. Implement single-text-child inline collapsing
4. Update height calculation for closing tag lines
5. Update click/hover hit detection

### Phase 2 — Visual polish
6. Color-coded syntax highlighting for different parts of the tag
7. Guide lines connecting opening to closing tags
8. Dimmed closing tags
9. Collapsed node indicator (`> ... 12 children`)

### Phase 3 — Prop display
10. Inline prop formatting (curated key props)
11. Prop verbosity toggle (minimal / standard / verbose)
12. Dimensions on anonymous nodes

### Phase 4 — Bridge accuracy (optional)
13. Pass `__primitiveName` through the bridge for accurate names
14. Show original JSX element name instead of Lua type mapping
