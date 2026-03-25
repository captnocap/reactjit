# Parity Carts

Real-world app clones that validate the tsz compiler and framework against patterns used in production React/web applications. Each cart is a self-contained `.app.tsz` + `.script.tsz` pair with hardcoded data.

## Build

```bash
bin/tsz build tsz/carts/parity/<dir>/<name>.app.tsz
bin/tsz dev tsz/carts/parity/<dir>/<name>.app.tsz   # hot-reload
```

All carts compile to clean codegen. Currently blocked on a framework/engine.zig refactor (vterm consolidation) — no cart-level fixes needed.

## Cart Index

### TodoMVC
**Entry:** `todomvc.app.tsz` (root level)
**Tests:** State management, `.map()` over filtered array, conditional styling, text input, computed values (active/completed counts), filter toggle.
**React pattern:** Classic controlled component — the "hello world" of React apps. Every framework comparison starts here.

### Hacker News
**Entry:** `hackernews/hackernews.app.tsz`
**Tests:** `.map()` over 30-item dataset, complex multi-column row layout, nested text styling, conditional rendering (job posts vs links), rank numbers, domain extraction display.
**React pattern:** Dense read-only list with heterogeneous row types. Tests whether the layout engine handles tight spacing and mixed text sizes.

### Reddit Clone
**Entry:** `reddit-clone/RedditClone.app.tsz`
**Tests:** Sidebar + main split layout, `.map()` over posts, vote interactions (upvote/downvote state), nested comment-style indentation, subreddit navigation.
**React pattern:** Two-column layout with interactive list items. Validates flex split panels and per-item state toggling.

### GitHub Issues
**Entry:** `github-issues/github-issues.app.tsz`
**Tests:** `.map()` over 20 issues, conditional status icons (open/closed), colored label badges, sidebar filter buttons, Open/Closed toggle, label filter, template literals for counts.
**React pattern:** Filterable list with sidebar controls. Tests filter state flowing from script to UI rebuild, conditional icon rendering, and badge styling.

### Spotify Clone
**Entry:** `spotify-clone/spotify.app.tsz`
**Tests:** 3-panel layout (sidebar + main + bottom player bar), `.map()` over 20 tracks, dark theme with green accent, progress bar, volume indicator, dense track list with album art placeholders.
**React pattern:** App shell with persistent chrome (player bar) and scrollable content. Tests fixed + flex layout composition.

### Twitter/X Clone
**Entry:** `twitter-clone/twitter-clone.app.tsz`
**Tests:** `.map()` over 20 tweets, avatar circles, multi-line row layout (name/handle/time + body + engagement row), conditional image placeholders, engagement icon row (reply/retweet/like/share), composer bar.
**React pattern:** Social feed — the most common production React pattern. Dense rows with multiple text styles and interaction targets.

### Slack Clone
**Entry:** `slack-clone/slack-clone.app.tsz`
**Tests:** Sidebar + main split, `.map()` over channels, DMs, and messages (3 separate lists), avatar circles, thread count indicators, conditional unread badges, text input bar, workspace header.
**React pattern:** Multi-list sidebar with main content area. Tests multiple independent `.map()` calls and conditional badge rendering.

### VS Code Clone
**Entry:** `vscode-clone/vscode-clone.app.tsz`
**Tests:** Deep nested layout (sidebar + editor + tabs + status bar), `.map()` over file tree and code lines, indent levels, tab bar with active state, status bar items, minimap placeholder.
**React pattern:** IDE-style layout with 4+ nested flex regions. Stress-tests the layout engine's handling of deeply nested flex containers.

### Notion Clone
**Entry:** `notion-clone/notion-clone.app.tsz`
**Tests:** Dual `.map()` (sidebar pages + content blocks), 8-way conditional block rendering (h1, h2, paragraph, bullet, numbered, todo, code, callout), todo checkbox toggle via script, nested depth styling in sidebar, breadcrumb trail.
**React pattern:** Block editor — conditional rendering at scale. Each block type has distinct styling, testing the compiler's ability to handle many conditional branches in a single map.

### Analytics Dashboard
**Entry:** `dashboard-analytics/dashboard-analytics.app.tsz`
**Tests:** KPI card grid, bar chart visualization with sized boxes, data table with conditional trend colors (green up / red down), date range toggle state.
**React pattern:** Dashboard with mixed visualization types. Tests grid-like layouts, proportional sizing, and conditional color theming.

### Figma Clone
**Entry:** `figma-clone/figma-clone.app.tsz`
**Tests:** 3-panel layout (layers + canvas + properties), `.map()` over layers, property inspector with key-value rows, toolbar, simulated canvas with positioned objects, zoom/selection state.
**React pattern:** Design tool layout with inspector panel. Tests property grids and multi-panel coordination.

## What These Validate

| Pattern | Carts that test it |
|---------|-------------------|
| `.map()` over arrays | All 11 |
| Conditional rendering | All 11 |
| Sidebar + main layout | Reddit, Slack, Spotify, VS Code, Notion, Figma |
| 3-panel layout | Spotify, VS Code, Figma |
| Filter/toggle state | TodoMVC, GitHub Issues, Dashboard |
| Dense list rows | HN, Twitter, GitHub Issues, Spotify |
| Nested depth/indent | Reddit, VS Code, Notion |
| Per-item interaction | TodoMVC, Reddit, Notion (todo), GitHub Issues |
| Template literals | All 11 |
| ScrollView | HN, GitHub Issues, Slack, Notion, Spotify |
| Multiple `.map()` calls | Slack (3x), Notion (2x), VS Code (2x) |
