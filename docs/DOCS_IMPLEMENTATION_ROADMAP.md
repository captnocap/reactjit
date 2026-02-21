# ReactJIT Documentation Implementation Roadmap

## Project Vision

**Build comprehensive ReactJIT documentation using ReactJIT itself**, rendering to all targets as a reference implementation and marketing showcase.

- **Web Version:** Full-featured interactive docs site
- **Love2D Version:** Desktop app for offline browsing
- **Terminal Version:** TUI for developers in terminal
- **ComputerCraft:** In-game searchable reference
- **Neovim:** Plugin for in-editor documentation
- **Hammerspoon:** macOS quick reference overlay
- **AwesomeWM:** Linux status bar accessible docs
- **LLM Access:** Structured `/llms.txt` endpoints for AI consumption

---

## Project Structure

```
reactjit-docs/
├── src/
│   ├── content/                 # All documentation content (shared)
│   │   ├── sections/
│   │   │   ├── 01-getting-started/
│   │   │   │   ├── index.tsx
│   │   │   │   ├── installation.tsx
│   │   │   │   ├── quick-start.tsx
│   │   │   │   └── philosophy.tsx
│   │   │   ├── 02-architecture/
│   │   │   ├── 03-cli-reference/
│   │   │   ├── 04-layout-system/
│   │   │   ├── 05-components/
│   │   │   ├── 06-hooks/
│   │   │   ├── 07-animation/
│   │   │   ├── 08-routing/
│   │   │   ├── 09-targets/
│   │   │   ├── 10-advanced/
│   │   │   ├── 11-troubleshooting/
│   │   │   └── 12-api-reference/
│   │   └── types/              # Shared content types
│   │       ├── ContentPage.ts
│   │       ├── APIReference.ts
│   │       └── Example.ts
│   │
│   ├── components/             # Shared UI components
│   │   ├── Navigation.tsx
│   │   ├── Sidebar.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── Table.tsx
│   │   ├── ApiTable.tsx
│   │   ├── ExampleViewer.tsx
│   │   └── SearchBar.tsx
│   │
│   ├── hooks/                  # Shared custom hooks
│   │   ├── useNavigation.ts
│   │   ├── useSearch.ts
│   │   ├── useTheme.ts
│   │   └── useContentIndex.ts
│   │
│   ├── utils/                  # Shared utilities
│   │   ├── contentLoader.ts
│   │   ├── searchIndex.ts
│   │   ├── codeHighlight.ts
│   │   └── apiExtractor.ts
│   │
│   ├── themes/                 # Target-specific themes
│   │   ├── web-theme.ts
│   │   ├── love2d-theme.ts
│   │   ├── terminal-theme.ts
│   │   ├── cc-theme.ts
│   │   └── shared-colors.ts
│   │
│   ├── targets/                # Target-specific entry points
│   │   ├── web-main.tsx        # Web version
│   │   ├── love2d-main.tsx     # Love2D version
│   │   ├── terminal-main.tsx   # Terminal version
│   │   ├── cc-main.tsx         # ComputerCraft version
│   │   ├── nvim-main.tsx       # Neovim version
│   │   ├── hs-main.tsx         # Hammerspoon version
│   │   └── awesome-main.tsx    # AwesomeWM version
│   │
│   └── llms/                   # LLM-accessible content
│       ├── index.tsx           # /llms.txt router
│       ├── api-reference.tsx   # /llms/api.txt
│       ├── troubleshooting.tsx # /llms/troubleshooting.txt
│       ├── cheatsheet.tsx      # /llms/cheatsheet.txt
│       └── examples.tsx        # /llms/examples.txt
│
├── examples/                   # Embedded runnable examples
│   ├── hello-world/
│   ├── todo-app/
│   ├── dashboard/
│   ├── animation-demo/
│   └── ...
│
├── public/                     # Static assets
│   ├── images/
│   ├── code-examples/
│   └── data/
│
├── scripts/                    # Build & generation scripts
│   ├── extract-api.ts          # Extract API from source
│   ├── generate-search-index.ts
│   ├── generate-llms.ts        # Generate /llms.txt content
│   ├── validate-docs.ts        # Lint documentation
│   └── build-all-targets.sh    # Multi-target build
│
├── .storybook/                 # Storybook for component development
│   ├── main.ts
│   └── stories/
│
├── package.json
├── tsconfig.json
├── vite.config.ts              # Web build config
├── love.conf.lua               # Love2D config
├── main.lua                    # Love2D entry
└── README.md

```

---

## Implementation Phases

### **PHASE 1: Core Infrastructure (Weeks 1-2)**

#### 1.1 Project Setup
- [ ] Create `reactjit-docs` example project (or use existing docs folder)
- [ ] Initialize npm workspace with shared packages
- [ ] Setup TypeScript configuration
- [ ] Configure esbuild for multi-target builds

#### 1.2 Content Structure
- [ ] Design content format (TypeScript + MDX-like structure)
- [ ] Create `ContentPage` type system
- [ ] Create `APIReference` type system
- [ ] Create `Example` type system
- [ ] Build content loader utilities

#### 1.3 Shared Components
- [ ] `<Navigation>` — responsive nav menu
- [ ] `<Sidebar>` — collapsible sidebar
- [ ] `<CodeBlock>` — syntax-highlighted code with copy button
- [ ] `<Table>` — data tables for API docs
- [ ] `<ApiTable>` — specialized API documentation tables
- [ ] `<ExampleViewer>` — embedded runnable examples
- [ ] `<SearchBar>` — search interface
- [ ] `<Breadcrumbs>` — navigation breadcrumbs
- [ ] `<Tabs>` — tab navigation
- [ ] `<CodeTabs>` — code examples across targets

#### 1.4 Theme System
- [ ] Color palette definitions (shared)
- [ ] Web-specific theme (CSS variables, dark/light mode)
- [ ] Love2D-specific theme (pixel art, retro feel)
- [ ] Terminal theme (ANSI colors, high contrast)
- [ ] ComputerCraft theme (16-color adaptation)
- [ ] Neovim theme (highlight groups)
- [ ] Hammerspoon theme (macOS design)
- [ ] AwesomeWM theme (Linux desktop theme)

#### 1.5 Custom Hooks
- [ ] `useNavigation()` — handle navigation per target
- [ ] `useSearch()` — search functionality
- [ ] `useTheme()` — theme switching
- [ ] `useContentIndex()` — index loading & caching
- [ ] `useCodeHighlight()` — syntax highlighting

---

### **PHASE 2: Documentation Content (Weeks 2-4)**

#### 2.1 Section 1: Getting Started
- [ ] Philosophy page
- [ ] Installation guide (per-target)
- [ ] Quick start (5-minute tutorials per target)
- [ ] First interactive app tutorial
- [ ] Project structure overview

#### 2.2 Section 2: Architecture
- [ ] Pipeline diagram + explanation
- [ ] Reconciler overview
- [ ] Layout engine explanation
- [ ] Transport layer details
- [ ] Painter abstractions
- [ ] **Source-of-Truth Architecture** (critical)

#### 2.3 Section 3: CLI Reference
- [ ] `reactjit init`
- [ ] `reactjit dev`
- [ ] `reactjit build` (all variants)
- [ ] `reactjit update`
- [ ] `reactjit lint`
- [ ] `reactjit screenshot`
- [ ] Flags & options tables

#### 2.4 Section 4: Layout System
- [ ] Flexbox fundamentals
- [ ] All style properties
- [ ] Layout rules (critical rules page)
- [ ] Common layout patterns
- [ ] Layout debugging guide
- [ ] Interactive layout playground

#### 2.5 Section 5: Components
- [ ] Box
- [ ] Text
- [ ] Image
- [ ] Pressable
- [ ] ScrollView
- [ ] TextInput
- [ ] Modal
- [ ] Slider
- [ ] Switch
- [ ] Checkbox
- [ ] Radio / RadioGroup
- [ ] Select
- [ ] Table
- [ ] BarChart
- [ ] ProgressBar
- [ ] Sparkline
- [ ] Breadcrumbs
- [ ] NavPanel
- [ ] Tabs
- [ ] Toolbar
- [ ] FlatList
- [ ] TextEditor
- [ ] (Each component: props table, examples, target notes)

#### 2.6 Section 6: Hooks
- [ ] useState
- [ ] useEffect
- [ ] useContext
- [ ] useReducer
- [ ] useRef
- [ ] useAnimation
- [ ] useSpring
- [ ] Custom hooks patterns

#### 2.7 Section 7: Animation
- [ ] `useAnimation()` API
- [ ] `useSpring()` API
- [ ] Easing functions reference
- [ ] Composite animations
- [ ] Animation recipes
- [ ] Performance tips

#### 2.8 Section 8: Routing
- [ ] Router package overview
- [ ] `RouterProvider` setup
- [ ] Navigation hooks
- [ ] Route matching
- [ ] History management
- [ ] Examples

#### 2.9 Section 9-14: Target-Specific Guides
Each target gets:
- [ ] Setup & prerequisites
- [ ] Architecture for that target
- [ ] Target-specific features
- [ ] Event handling
- [ ] Performance notes
- [ ] Examples & patterns
- [ ] Deployment guide
- [ ] Troubleshooting

---

### **PHASE 3: Target-Specific UI Implementations (Weeks 4-6)**

#### 3.1 Web Version
- [ ] React Router integration
- [ ] Full-featured navigation
- [ ] Dark/light mode toggle
- [ ] Full-text search (via Lunr.js or similar)
- [ ] Mobile-responsive design
- [ ] Interactive code playgrounds (CodeSandbox/Stackblitz integration)
- [ ] Copy-to-clipboard for code
- [ ] Print-friendly styles
- [ ] Sitemap & SEO

#### 3.2 Love2D Version
- [ ] Menu system
- [ ] Navigation sidebar
- [ ] Pagination (prev/next chapter)
- [ ] Local search (indexed)
- [ ] Keyboard navigation (arrow keys, Tab)
- [ ] Full-screen code viewer
- [ ] Example viewer (embedded)
- [ ] Bookmarks/favorites
- [ ] Fullscreen mode

#### 3.3 Terminal Version
- [ ] TUI navigation (vim-like or arrow keys)
- [ ] Table of contents sidebar
- [ ] Code with syntax highlighting
- [ ] Searchable index
- [ ] Keyboard shortcuts help
- [ ] Pager for long content
- [ ] Copy to clipboard
- [ ] Link following (via shell command)

#### 3.4 ComputerCraft Version
- [ ] Menu navigation
- [ ] Search by topic
- [ ] Simplified layouts (51x19 constraint)
- [ ] Keyboard navigation
- [ ] Color-coded sections
- [ ] Quick reference cards
- [ ] Integration with CC turtle environment

#### 3.5 Neovim Version
- [ ] Floating window layout
- [ ] Buffer-based content
- [ ] Jump to definitions
- [ ] Integration with vim folds/marks
- [ ] Telescope integration for search
- [ ] Keybinding help
- [ ] Copy to system clipboard

#### 3.6 Hammerspoon Version
- [ ] Desktop overlay widget
- [ ] Search via hotkey
- [ ] Quick reference cards
- [ ] Mouseless navigation
- [ ] System integration
- [ ] Always-on-top option
- [ ] Transparency/opacity control

#### 3.7 AwesomeWM Version
- [ ] Status bar integration
- [ ] Click-to-expand windows
- [ ] Search in popup
- [ ] Keyboard navigation
- [ ] Theme matching with WM
- [ ] Persistent window management
- [ ] Taskbar integration

---

### **PHASE 4: LLM Integration (/llms.txt) (Week 4-5)**

#### 4.1 /llms.txt Infrastructure
- [ ] Create HTTP server for LLM endpoints (or static file export)
- [ ] Router: `/llms.txt` → full documentation
- [ ] Router: `/llms/api.txt` → API reference only
- [ ] Router: `/llms/components.txt` → component docs only
- [ ] Router: `/llms/troubleshooting.txt` → troubleshooting only
- [ ] Router: `/llms/cheatsheet.txt` → quick reference
- [ ] Router: `/llms/examples.txt` → code examples only

#### 4.2 Content Extraction
- [ ] Script to extract API signatures from source
- [ ] Script to generate API reference tables
- [ ] Script to generate cheatsheet from docs
- [ ] Script to generate troubleshooting index
- [ ] Script to embed code examples
- [ ] Format output as plain text (LLM-friendly)

#### 4.3 LLM Optimization
- [ ] Structure content for token efficiency
- [ ] Include type signatures
- [ ] Include complete prop tables
- [ ] Include all error codes
- [ ] Include all CLI options
- [ ] Cross-reference links (not URLs, but references)
- [ ] Searchable index (plaintext)

#### 4.4 Distribution
- [ ] Generate `/llms.txt` during build
- [ ] Include in dist outputs
- [ ] Host on documentation site
- [ ] Update during CI/CD pipeline
- [ ] Version alongside releases

---

### **PHASE 5: Build Pipeline & Distribution (Week 6)**

#### 5.1 Multi-Target Build
- [ ] Script: `npm run build:all` (builds all targets)
- [ ] Script: `npm run build:web` (web only)
- [ ] Script: `npm run build:love2d` (dist:love)
- [ ] Script: `npm run build:terminal` (dist:terminal)
- [ ] Script: `npm run build:cc` (CC standalone)
- [ ] Script: `npm run build:nvim` (Nvim plugin)
- [ ] Script: `npm run build:hs` (HS spoon)
- [ ] Script: `npm run build:awesome` (Awesome package)

#### 5.2 Development Workflow
- [ ] `npm run dev` — watch mode (all targets)
- [ ] `npm run dev:web` — web only (with HMR)
- [ ] `npm run dev:love2d` — Love2D with HMR
- [ ] `npm run dev:terminal` — terminal with HMR
- [ ] `npm run storybook` — component development

#### 5.3 CI/CD Pipeline
- [ ] GitHub Actions workflow
- [ ] Lint documentation content
- [ ] Validate all links
- [ ] Generate search indices
- [ ] Build all targets
- [ ] Generate /llms.txt files
- [ ] Deploy web version to GitHub Pages
- [ ] Release self-extracting binaries
- [ ] Publish to npm registries

#### 5.4 Documentation Validation
- [ ] Script: Check all internal links
- [ ] Script: Validate code examples (compile check)
- [ ] Script: Check API table consistency
- [ ] Script: Verify all components documented
- [ ] Script: Verify all hooks documented
- [ ] Script: Check coverage against checklist

---

### **PHASE 6: Marketing & Polish (Week 6+)**

#### 6.1 Marketing Assets
- [ ] Landing page (web)
- [ ] Feature showcase (Love2D)
- [ ] Comparison matrix (all targets)
- [ ] Video tutorials (embed in docs)
- [ ] Live demo links
- [ ] Twitter/social media share buttons

#### 6.2 Accessibility
- [ ] WCAG 2.1 AA compliance (web)
- [ ] Screen reader testing
- [ ] Keyboard navigation
- [ ] Color contrast checks
- [ ] Alt text for images

#### 6.3 Performance
- [ ] Web: lighthouse score > 95
- [ ] Love2D: < 50MB binary
- [ ] Terminal: < 10MB Node.js executable
- [ ] Load time < 2s (all targets)
- [ ] Search response < 200ms

#### 6.4 Completeness Check
- [ ] All 22 doc sections written
- [ ] All 180+ topics covered
- [ ] All examples working
- [ ] All targets rendering
- [ ] All /llms.txt endpoints working
- [ ] No broken links
- [ ] No orphaned pages

---

## Technology Stack

### **Shared**
- React 18.3+ (core framework)
- TypeScript (type safety)
- ReactJIT (rendering across targets)
- Zod (schema validation for content)

### **Web**
- Vite (bundler)
- React Router (navigation)
- Lunr.js (full-text search)
- Prism.js (syntax highlighting)
- Tailwind CSS (styling)

### **Love2D**
- Love 11+ (runtime)
- QuickJS (JS runtime)
- love.graphics (rendering)

### **Terminal**
- Node.js 18+
- chalk (colors)
- ink (TUI rendering) / ReactJIT terminal
- fuse.js (fuzzy search)

### **ComputerCraft**
- ComputerCraft Tweaked
- WebSocket server (for communication)

### **Neovim**
- Neovim 0.7+
- neovim npm package (RPC)
- packer.nvim (plugin manager)

### **Hammerspoon**
- Hammerspoon 0.9+
- Spoon framework

### **AwesomeWM**
- AwesomeWM 4.3+
- Lua 5.3+
- Cairo/Pango

---

## File Structure Summary

```
src/content/sections/
├── 01-getting-started/
│   ├── index.tsx              # Hub page
│   ├── philosophy.tsx         # Philosophy page
│   ├── installation.tsx       # Installation guide
│   ├── quick-start.tsx        # 5-minute tutorial
│   └── first-app.tsx          # Interactive tutorial
│
├── 02-architecture/
│   ├── index.tsx              # Hub page
│   ├── pipeline.tsx           # Rendering pipeline
│   ├── reconciler.tsx         # Reconciler details
│   ├── layout-engine.tsx      # Layout engine
│   ├── transport.tsx          # Transport layer
│   ├── painter.tsx            # Painter abstractions
│   └── source-of-truth.tsx    # CRITICAL: Source of truth

... (sections 03-12 similar structure)
```

Each section has:
- `index.tsx` — Hub/overview page
- Multiple topic pages
- Shared navigation

---

## Content Format

### **Example: Component Documentation**

```typescript
// src/content/sections/05-components/Box.tsx
import { ContentPage, ComponentDoc, Example } from '../types';

export const BoxComponent: ComponentDoc = {
  name: 'Box',
  category: 'Primitives',
  description: 'Flexible layout container using Flexbox',

  props: [
    { name: 'style', type: 'Style', required: false, description: 'Style object' },
    { name: 'children', type: 'ReactNode', required: false, description: 'Child elements' },
    // ...
  ],

  examples: [
    {
      title: 'Basic Box',
      code: `
        <Box style={{ width: 200, height: 100, backgroundColor: '#f0f0f0' }} />
      `,
      platforms: ['love2d', 'web', 'terminal']
    },
    // ...
  ],

  seeAlso: ['FlexDirection', 'Padding', 'Margin'],

  targetNotes: {
    web: 'Uses CSS Flexbox',
    love2d: 'Uses Lua flexbox engine',
    terminal: 'Grid-based layout',
  }
};
```

---

## LLM Content Structure

### **Example: /llms/api.txt**

```
========================================
ReactJIT API Reference
========================================

COMPONENTS
----------

Box
  Container component using Flexbox
  Props:
    - style: Style object
    - children: ReactNode
  Targets: All

Text
  Text rendering component
  Props:
    - style: Style object (fontSize REQUIRED)
    - children: string | ReactNode
  Targets: All
  WARNING: Must include fontSize in style

Image
  Image display component
  Props:
    - source: string (path or URL)
    - style: Style object
  Targets: All

[... more components ...]

HOOKS
-----

useState: React.useState functionality
useEffect: Side effects and lifecycle
[... more hooks ...]

API TABLES
----------

[Text format tables for all APIs]

STYLE PROPERTIES
----------------

width, height, padding, margin, ...
[Complete property reference]
```

---

## Development Workflow

### **Local Development**

```bash
# Setup
npm install
make cli-setup
reactjit update

# Development
npm run dev                    # Watch all targets
npm run dev:web              # Web with HMR
npm run dev:love2d           # Love2D
npm run dev:terminal         # Terminal

# Storybook for component dev
npm run storybook

# Building
npm run build:all            # Build all targets
npm run build:web            # Web only
npm run build:love2d         # Love2D dist:love

# Validation
npm run validate:docs        # Lint docs
npm run generate:search      # Generate search index
npm run generate:llms        # Generate /llms.txt
```

---

## Distribution Strategy

### **Web**
- Host on GitHub Pages or Vercel
- CDN delivery
- `/llms.txt` accessible via HTTP

### **Love2D**
- Self-extracting binary (reactjit build dist:love)
- Upload to itch.io, GitHub Releases
- Cross-platform (Linux, Windows, macOS)

### **Terminal**
- Single-file Node.js executable (npm pkg-based)
- Upload to npm registry
- `npm install -g reactjit-docs`
- GitHub Releases

### **ComputerCraft**
- CC Program API (pastebin/gist hosting)
- Downloadable via `pastebin get` or direct transfer

### **Neovim**
- vim-plug support
- packer.nvim support
- GitHub Release (Vim package spec)
- Published to neovim plugin registry

### **Hammerspoon**
- Spoon package (Hammerspoon Spoon Archive)
- Direct download & load

### **AwesomeWM**
- LuaRocks package
- Direct deployment to rc.lua

---

## Success Metrics

- [ ] **Coverage:** 180+ documentation topics
- [ ] **Completeness:** All components, hooks, targets documented
- [ ] **Quality:** Zero broken links, all examples working
- [ ] **Performance:** All targets load < 2s
- [ ] **Accessibility:** WCAG 2.1 AA (web)
- [ ] **LLM Ready:** /llms.txt endpoints serving clean content
- [ ] **Multi-Platform:** All 7 targets fully functional
- [ ] **Reference Implementation:** Showcases best practices

---

## Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1 | Weeks 1-2 | Core infrastructure, shared components, theme system |
| 2 | Weeks 2-4 | All documentation content (180+ topics) |
| 3 | Weeks 4-6 | Target-specific UI implementations |
| 4 | Weeks 4-5 | /llms.txt infrastructure & endpoints |
| 5 | Week 6 | Build pipeline, CI/CD, distribution |
| 6 | Week 6+ | Marketing, polish, accessibility |

**Total: 6 weeks to production**

---

## Next Steps

1. **Fork `reactjit` repo or create `reactjit-docs` example project**
2. **Copy this roadmap into project README**
3. **Set up Phase 1 infrastructure**
4. **Create content structure from master checklist**
5. **Iterate through phases sequentially**
6. **Get community feedback during Phase 3-4**
7. **Launch Phase 5 build pipeline**
8. **Go live with all targets**

---

## Notes

- This docs site is a **reference implementation** of ReactJIT
- Use it to showcase framework capabilities
- Every feature used in docs can be a teaching example
- The code becomes part of the examples
- The docs become marketing material

This approach turns documentation into a living, multi-platform showcase of what ReactJIT can do.
