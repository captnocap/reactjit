# Visual Spec — What Each Test Should Look Like

Run each binary and compare against this. If it doesn't match, it's failing.

---

## d01 — Nested Maps

**Layout:** Scrollable list of 3 groups, each with sub-items indented below.

```
Group 0: Alpha
  ├─ item-a-0  10  [0,0]
  ├─ item-a-1  20  [0,1]
  └─ item-a-2  30  [0,2]
Group 1: Beta
  ├─ item-b-0  40  [1,0]
  └─ item-b-1  50  [1,1]
Group 2: Gamma
  ├─ item-c-0  60  [2,0]
  ├─ item-c-1  70  [2,1]
  └─ item-c-2  80  [2,2]
selected: 0
```

- Group headers are red text (#e94560)
- Sub-items are dark blue rows (#0f3460), each row shows `label  value [groupIdx,itemIdx]`
- Clicking any sub-item sets `selected` to `gi * 100 + ii` (e.g. clicking item-b-1 → selected: 101)
- Background: dark navy (#1a1a2e)

---

## d02 — Component Returning Map

**Layout:** Header "Tags", then a row of colored pill badges wrapping horizontally.

```
Tags
[bug] [feature] [docs] [wontfix] [duplicate]
picked: 0
```

- `bug` = red (#d73a4a), `feature` = blue (#0075ca), `docs` = green (#0e8a16), `wontfix` = gray (#6a737d), `duplicate` = light gray (#cfd3d7)
- All pills are rounded (borderRadius 12), white text, wrapped in a row with flexWrap
- Clicking a pill sets `picked` to that pill's index (0-4)
- Background: very dark (#0d1117)

---

## d03 — Conditional Wrapping Map

**Layout:** Toggle button + conditional todo list + tap counter.

```
[Hide]                    ← red button, toggles show/hide
[x] 0: Buy milk          ← green checkmark (done=1)
[ ] 1: Write tests        ← red empty box (done=0)
[ ] 2: Break compiler
[ ] 3: Fix compiler
taps: 0
```

- Button text changes: "Hide" when list visible, "Show" when hidden
- Clicking button toggles the entire list visible/invisible
- Each row is clickable — increments tap counter
- `[x]` is green (#51cf66), `[ ]` is red (#ff6b6b)
- Background: dark gray (#2d2d2d)
- List starts VISIBLE (script sets showList=1)

---

## d04 — Map Handler Captures

**Layout:** Bonus button on top, 3 entry rows, result at bottom.

```
[Bonus: 5]               ← red button, +10 each click

Alice       score=100 i=0 bonus=5
Bob         score=200 i=1 bonus=5
Carol       score=300 i=2 bonus=5

result: 0
```

- Clicking "Bonus" increments bonus by 10 (5 → 15 → 25...)
- Clicking a row sets `result = entry.score + index + bonus`
  - e.g. clicking Bob with bonus=5: result = 200 + 1 + 5 = 206
- The bonus value shown in each row should update when bonus changes
- Background: dark navy (#1b1b2f), rows are darker blue (#162447)

---

## d05 — Dynamic Style in Map

**Layout:** Title "Dynamic Bars", then 5 horizontal bar chart rows.

```
Dynamic Bars
Rust   [████████████████████████] 85%
Zig    [███████████████████]     72%
C      [██████████████████]       60%
Go     [████████████████]         45%
JS     [█████████]                30%
```

- Each bar's WIDTH is computed from `bar.pct * 3` pixels
- Each bar's COLOR comes from `bar.color` (teal, purple, pink, dark teal, dark purple)
- Clicking a row sets `highlight` to that index — highlighted row shows a purple `*` at the end
- Labels are 60px wide, left-aligned
- Background: very dark (#121212)

---

## d06 — Ternary JSX Branches

**Layout:** Toggle button + one of two completely different panels.

**Branch A (mode=0, initial):**
```
[Switch to B]            ← red button
Branch A                 ← red/pink large text
⬤ ⬛ ⬜                  ← 3 colored shapes: red circle, orange rounded, yellow square-ish
A taps: 0               ← clickable, +1 per tap
```

**Branch B (mode=1):**
```
[Switch to A]            ← red button
Branch B                 ← blue large text
━━━━━━━━━━              ← 2 blue horizontal bars stacked
B taps: 0               ← clickable, +10 per tap
```

- Button toggles between modes
- Branch A has 3 shapes in a row (circle r20, rounded r8, slight-round r4)
- Branch B has 2 stacked horizontal bars
- Tap counter is shared — tapping in A (+1) then switching to B shows the accumulated count, B adds +10
- Background: very dark (#1a1a1a)

---

## d07 — Sibling Maps Shared State

**Layout:** Total counter on top, two columns side by side.

```
Total: 0
Left                Right
┌──────────┐       ┌──────────┐
│ 0: alpha │       │ 0: one   │
│ 1: beta  │       │ 1: two   │
│ 2: gamma │       │          │
└──────────┘       └──────────┘
```

- Left column: 3 items (alpha, beta, gamma) — each click adds +1 to total
- Right column: 2 items (one, two) — each click adds +10 to total
- Total at top should increment from EITHER side
- Left cards: blue-ish (#1a1a2e), Right cards: red-ish (#2e1a1a)
- "Left" label is green (#00ff88), "Right" label is red (#ff0055)
- Background: black (#0a0a0a)

---

## d08 — Map Classifier Components

**Layout:** Title "Status Board", then 5 rows with colored status badges on the right.

```
Status Board
Database        [OK: 99]       ← green badge
API Gateway     [WARN: 47]     ← yellow badge, black text
Cache           [CRIT: 12]     ← red badge
CDN             [OK: 100]      ← green badge
Auth            [WARN: 65]     ← yellow badge
active: 0
```

- Badge component receives `kind` and `value` as props from the map item
- kind=0 → green "OK: {value}", kind=1 → yellow "WARN: {value}", kind=2 → red "CRIT: {value}"
- Clicking a row sets `active` to that row's index
- Background: dark slate (#0f172a), rows are darker (#1e293b)

---

## d09 — Nested Template Scope

**Layout:** Offset button on top, then 4 clickable rows with computed values.

```
[offset: 100]            ← purple button, +1 each click

[0] point-a: x=10 y=20 sum=130
[1] point-b: x=30 y=40 sum=171
[2] point-c: x=50 y=60 sum=212
[3] point-d: x=70 y=80 sum=253

log: 0
```

- Sum formula: `row.x + row.y + ri + offset` (e.g. row 0: 10+20+0+100=130)
- Clicking offset button increments offset → all sums should increase by 1
- Clicking a row sets `log` to that row's sum value
- Background: very dark (#18181b)

---

## d10 — Handler Triple Capture

**Layout:** Multiplier button, status line, then 15 scrollable planet rows.

```
Triple Capture
[multiplier: 1]  acc: 0 | lastIdx: 0 | lastW: 0 | clicks: 0

0. Mercury    A  w:3   = 4
1. Venus      B  w:6   = 8
2. Earth      C  w:9   = 12
3. Mars       A  w:12  = 16
...
14. Quaoar    C  w:45  = 60
```

- Category badges: A=green, B=blue, C=red
- `= value` is `entry.weight * multiplier + idx`
- Clicking multiplier button increments it (1→2→3...) — all `= values` should update
- Clicking a row: sets accumulator += (weight * multiplier + idx), sets lastIdx, lastWeight, increments clicks
- All status values in the header should update on every click
- Background: near-black (#0c0a09)

---

## d11 — Map → Component → Map

**Layout:** "Org Chart" header, status line, then 5 department sections each with employee sub-lists.

```
Org Chart
dept: 0 | emp: 0 | clicks: 0

▎ Engineering                       ← blue bar when selected, gray when not
  8 people | $450k budget
    ● Alice    $120               ← green dot = active
    ● Bob      $115
    ● Carol    $130
    ○ Dave     $95                ← gray dot = inactive

▎ Design
  4 people | $200k budget
    ● Eve      $105
    ● Frank    $110

...3 more departments...
```

- Clicking a department header: sets selectedDept, increments totalClicks, shows blue highlight bar
- Clicking an employee: sets selectedEmp, increments totalClicks
- Active employees (active=1): green dot (#22c55e)
- Inactive employees (active=0): gray dot (#475569)
- Employees are indented (paddingLeft: 12) and filtered by `emp.deptIdx == deptIdx`
- Background: near-black (#020617)

---

## d12 — Evil Kanban

**Layout:** Header bar with filters, then 4 kanban columns side by side.

```
Evil Kanban          sel:0 exp:0 edit:0 moves:0 drag:0  [All] [Med+] [High] [Done: show]

● Backlog      wip:0    ● In Progress  wip:3    ● Review    wip:2    ● Done      wip:0
┌──────────────┐       ┌──────────────┐        ┌──────────────┐     ┌──────────────┐
│⬤ Auth flow.. │       │⬤ Refactor..  │        │⬤ Error bou..│     │✓ CI pipeline │
│ security  ux │       │ tech-debt .. │        │ infra        │     │ devops       │
│ #0           │       │ #4           │        │ #7           │     │✓ Design v1   │
│⬤ Fix Safari..│       │⬤ Perf audit..│        │⬤ Loading sk..│     │ design front │
│ browser      │       │ perf frontend│        │ ux           │     │✓ Onboarding  │
│ ...          │       │ ...          │        │ ...          │     │ ux           │
└──────────────┘       └──────────────┘        └──────────────┘     └──────────────┘
```

- Column headers: colored dot + title + wip badge
- Each card: priority dot (gray/yellow/red) + title + tag pills + done checkmark + expandable detail + assignee avatar
- **Filter buttons:** "All" shows everything. "Med+" hides priority=0 tasks. "High" shows only priority=2. "Done: show/hide" toggles done tasks.
- **Clicking a card:** selects it (title brightens), increments moves, sets dragSource
- **Clicking "...":** opens edit mode — card swaps to inline edit form with Save/Cancel
- **Expanded view:** shows effort, column info, Move/Collapse buttons
- **Tags change on selection:** selected task's tags become white-on-white instead of colored
- **Sparse rendering:** tasks that don't match filters should NOT render (empty space, not hidden)
- Background: near-black (#020617)

---

## d13 — Schema Form

**Layout:** Sidebar with 4 section tabs, main area with form fields.

```
Settings                              Form Builder                    [Save]
────────                              ──────────
▎ U Personal     ← active, blue     Personal
  W Work                             ┌─────────────────────────────┐
  P Preferences                      │ Full Name                   │  0:0 | edits:0
  N Notifications                    │ [Enter your name]           │
                                     │ Modified — unsaved          │  ← only when dirty+lastEdited
Unsaved changes                      │                             │
edits: 3 | last: #2                  │ Email                       │  0:1 | edits:0
                                     │ [you@example.com]           │
                                     │                             │
                                     │ Phone                       │  0:2 | edits:0
                                     │ [+1 (555) 000-0000]         │
                                     │                             │
                                     │ Public Profile   [●━━━]ON  │  ← toggle switch
                                     └─────────────────────────────┘
                                     Personal:0 / edits:0 / dirty:0  ← derived text
```

- 4 sections in sidebar: Personal, Work, Preferences, Notifications — each with icon letter + label
- Active section has blue indicator bar, white text; others are gray
- Switching sections shows different fields
- **Field types:**
  - type 0 (text): gray placeholder text in a bordered box. Shows "Modified — unsaved" when `formDirty==1 AND lastEdited==thisField`
  - type 1 (toggle): label + toggle switch (green=on, gray=off)
  - type 2 (select): 3 option buttons in a row, selected one is blue
  - type 3 (number): minus/plus buttons with value between them. Shows extra text when `activeSection==sectionIdx && formDirty==1`
- **Status line per field:** tiny gray text showing `sectionIdx:fieldIdx | edits:count`
- **Section header:** derived text `sectionLabel:si / edits:count / dirty:flag`
- **Save button:** only visible when formDirty==1, clicking clears dirty + validation
- Clicking any field widget: sets lastEdited, increments editCount, sets formDirty=1
- Background: very dark (#111827)

---

## 01 — Ecommerce Dashboard (port)

**Layout:** Full scrollable dashboard with cards, charts placeholders, transaction lists.

- Top: earnings card ($63,448.78) with purple download button + 4 stat cards (Customers, Products, Sales, Refunds) each with icon, amount, percentage
- Middle: Revenue Updates section with $93,438 budget / $48,487 expense + sparkline/stacked chart placeholders
- Right side: purple earnings card ($63,448.78 monthly) + pie chart placeholder ($43,246 yearly)
- Bottom row: Recent Transactions list (5 items with icons), Sales Overview chart, Weekly Stats (3 items), MedicalPro Branding card with teams/leaders, Daily Activities card
- All in white cards on light gray background (#fafbfb)
- Purple accent (#7c3aed)

---

## 02 — Admin Panel (port)

**Layout:** Sidebar + navbar + content area.

- Sidebar: "lamadmin" logo, 12 nav items grouped (MAIN/LISTS/USEFUL/SERVICE/USER), dark mode toggle squares at bottom
- Navbar: search box, language indicator, dark mode text, purple avatar circle
- Dashboard view (section 0): 4 widget cards (USERS/ORDERS/EARNINGS/BALANCE), 2 chart placeholders, transaction table with user rows (avatar, name, email, age, status badge, View/Delete buttons)
- Users view (section 1): "Add New" button + user table with same rows
- Active status = green "Active" badge, inactive = red "Passive" badge
- Clicking sidebar items switches sections
- Clicking rows selects them

---

## 03 — Jira Board (port)

**Layout:** 4-column kanban board with issue detail overlay.

- Header: "Kanban board" + search box + 3 avatar circles + "Only My Issues" + "Recently Updated" filter toggles
- 4 columns: BACKLOG (4), SELECTED FOR DEVELOPMENT (2), IN PROGRESS (3), DONE (2)
- Each issue card: title + type icon (T=blue task, B=red bug, S=green story) + priority icon (L=blue, M=orange, H=red) + avatar
- Clicking a card opens detail overlay (right panel, 600px wide):
  - Top: type icon + task ID + close button
  - Left: title, description, comments input
  - Right: STATUS selector (Backlog/In Progress/Done), ASSIGNEES, PRIORITY selector, dates
- Filter toggles highlight blue when active
- Background: light gray (#f4f5f7), cards are white
