---
name: scaffold-package-story
description: "Scaffold and populate a Layout2-style documentation story for a ReactJIT package. Use when the user says '/scaffold-package-story PackageName', 'scaffold a package story for X', 'create a package doc for X', or wants a new hook/API documentation page in the storybook. Generates the file with zigzag narrative layout, then fills in real exports, hooks, usage examples, and gotchas."
---

# Scaffold Package Story

Generate a Layout2 documentation page for a ReactJIT package — hook/API-heavy packages
where a narrative walkthrough with embedded code examples AND live interactive demos
makes more sense than a static playground.

## THE PATTERN: Live Demos + Code Examples (LEARN FROM CryptoStory)

The gold standard is `CryptoStory.tsx`. Every major feature gets TWO things:
1. **A live demo component** — actually calls the package hooks, shows real output
2. **A code example** — static CodeBlock showing the API usage

The CryptoStory has `HashDemo`, `EncryptDemo`, `SignDemo`, `TokenDemo` — each one
imports the real hook (`useCrypto`), calls it, and renders the actual results with
state management. This is what makes stories useful: users SEE the feature working,
not just read about it.

**Demo components are separate named functions** defined above the main story export.
They are self-contained: own state, own effects, own error handling. They use
`useThemeColors()` for styling and display real outputs from the package's API.

**The structure for each feature section:**
```
StorySection "Feature Name"
  ├── Live demo component (calls real hooks, shows real output)
  └── OR CodeBlock with usage example (for simple APIs)
```

**Prefer live demos over static CodeBlocks when:**
- The hook returns data that can be displayed (hashes, tokens, query results)
- The feature has interactive elements (buttons to regenerate, toggle states)
- Showing real output proves the feature works (round-trip OK, signature valid)

**Use static CodeBlocks when:**
- The feature is configuration-only (no visible output)
- The API is a simple one-liner that doesn't need demonstration
- Showing the import/usage pattern is more valuable than a live result

## THE RULE (NON-NEGOTIABLE)

**There is no shared wrapper. Every story is a FLAT file with static hoisted constants.**

All code strings, style objects, and data arrays are `const` declarations at the TOP of
the file, outside the component function. This prevents CodeBlock from receiving new
string identities at 60fps, which causes the Lua tokenizer to re-run continuously.

## Step 0: Check existence

If the story file already exists:
1. Read it and extract all content (code blocks, descriptions, section labels)
2. Delete the old file
3. Run the scaffold script to generate a fresh skeleton
4. Port the extracted content into the new skeleton
5. Continue to Step 3

## Step 1: Generate the skeleton

```bash
bash scripts/scaffold_package_story.sh <Name> [Section]
```

- `<Name>` is PascalCase (e.g., `Privacy`, `Storage`, `AudioSynth`)
- `[Section]` defaults to `Packages` — use `Core`, `Demos`, `Dev`, etc. as needed
- The script creates `storybook/src/stories/<Name>Story.tsx` and registers it in `index.ts`
- It refuses to overwrite existing files (use Step 0 flow for existing stories)

## Step 2: Find real exports

Read the package's entry point to discover what it exports:

```bash
# Main entry
cat packages/<pkg>/src/index.ts

# Or check for barrel exports
ls packages/<pkg>/src/

# Check for Lua capabilities
ls lua/capabilities/<pkg>*.lua 2>/dev/null
```

Categorize exports into:
- **Hooks** (`useX`, `useY`) — these are the primary documentation targets
- **Components** (if any) — wrapped capabilities, providers
- **Utility functions** — helpers, formatters, converters
- **Types/interfaces** — important type exports
- **Capabilities** — Lua-side registered capabilities

## Step 3: Edit the generated file

Fill in all `TODO:` placeholders with real content:

### Header
- **Title**: the primary hook or package name (e.g., `usePrivacy`, `Storage`)
- **Badge**: `@reactjit/<pkg>` (already correct from scaffold)
- **Description**: one-liner summarizing the package

### Hero band
- **Bold line**: one-liner pitch — what does this package let you do?
- **Muted line**: 1-2 sentences expanding on the pitch

### INSTALL_CODE
Real import statement(s):
```typescript
const INSTALL_CODE = `import { usePrivacy, PolicyBadge } from '@reactjit/privacy'`;
```

### Sections with Live Demos (PRIMARY PATTERN)

Each major feature gets a `StorySection` with a **live demo component** that actually
exercises the package's API. This is the CryptoStory pattern — the demo imports the
real hook, calls it with real inputs, and renders the real output.

**Demo component template:**
```tsx
// ── Feature Demo ───────────────────────────────────────

function FeatureDemo() {
  const c = useThemeColors();
  const pkg = usePackageHook();  // <-- the real hook
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pkg.doThing('input').then(res => {
      setResult(res);
      setError(null);
    }).catch(err => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  return (
    <>
      <Text style={{ fontSize: 9, color: c.textDim }}>Implementation detail (e.g. "via Lua FFI")</Text>

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>Input:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.info }}>{'"input value"'}</Text>
        </Box>
      </Box>

      {error && (
        <Text style={{ fontSize: 10, color: c.error }}>{`Error: ${error}`}</Text>
      )}

      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 10, color: c.success, fontWeight: 'normal' }}>Output:</Text>
        <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{result}</Text>
        </Box>
      </Box>
    </>
  );
}
```

**Key patterns from CryptoStory demos:**
- Each demo is a **separate named function** with a comment banner (`// ── Name ───`)
- Uses `useState` + `useEffect` to call the hook and store results
- Always has error state and displays errors with `c.error` color
- Shows input → output flow: what went in, what came out
- Uses colored labels per result type (`c.info`, `c.success`, `c.warning`, `c.accent`)
- Interactive demos get a `Pressable` button (e.g., "Regenerate" in TokenDemo)
- Validation indicators: colored dot + text ("Signature valid", "Round-trip OK")
- Results displayed in `c.bg` boxes with `borderRadius: 4` and `padding: 4`

**Interactive demo with regenerate button:**
```tsx
function TokenDemo() {
  const c = useThemeColors();
  const pkg = usePackageHook();
  const [value, setValue] = useState('');

  const regenerate = useCallback(() => {
    pkg.generate().then(setValue);
  }, [pkg]);

  useEffect(() => { regenerate(); }, []);

  return (
    <>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, color: c.textDim }}>description</Text>
        <Pressable onPress={regenerate}>
          <Box style={{ backgroundColor: c.info, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: '#000', fontWeight: 'normal' }}>Regenerate</Text>
          </Box>
        </Pressable>
      </Box>
      <Box style={{ backgroundColor: c.bg, padding: 4, borderRadius: 4 }}>
        <Text style={{ fontSize: 10, color: c.textSecondary }}>{value}</Text>
      </Box>
    </>
  );
}
```

### Feature Catalog Section

For packages with many features/algorithms/options, add a **FeatureList** component
that renders a colored dot + label + description per item (see CryptoStory's
`FeatureList` with algorithm catalog). This gives users an at-a-glance view of
everything the package supports.

```tsx
function FeatureList() {
  const c = useThemeColors();
  const features = [
    { label: 'Feature A', desc: 'Description', color: c.info },
    { label: 'Feature B', desc: 'Description', color: c.success },
  ];
  return (
    <>
      {features.map(f => (
        <Box key={f.label} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: f.color }} />
          <Text style={{ fontSize: 10, color: c.text, fontWeight: 'normal', width: 100 }}>{f.label}</Text>
          <Text style={{ fontSize: 10, color: c.textSecondary }}>{f.desc}</Text>
        </Box>
      ))}
    </>
  );
}
```

### Code Examples Section

After the live demos, add a **UsageExamples** section with static CodeBlocks showing
the API patterns. This complements the demos — demos prove it works, code examples
teach how to use it.

Use a local `CodeBlock` helper (NOT imported — defined in the same file):
```tsx
function CodeBlock({ label, code, color }: { label: string; code: string[]; color?: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.bg, borderRadius: 6, padding: 10, gap: 3 }}>
      <Text style={{ fontSize: 9, color: c.textDim }}>{label}</Text>
      {code.map((line, i) => (
        <Text key={i} style={{ fontSize: 10, color: color || c.success }}>{line}</Text>
      ))}
    </Box>
  );
}
```

### Zigzag bands (Layout2 variant)
If using the Layout2 zigzag format instead of StoryPage/StorySection, each band has:
- **SectionLabel** with icon + uppercase label (e.g., `icon="shield"` + `ENCRYPTION`)
- 1-2 sentence explanation of the feature
- Live demo component OR CodeBlock on the "code" side

### Callout band
Key insight, gotcha, or important note about the package. Examples:
- "All crypto operations run in Lua — zero JS overhead."
- "Policies are declarative — define once, enforce everywhere."

### Additional bands
Add more zigzag pairs as needed for additional hooks/features. Maintain the alternating
pattern: text|code, code|text, text|code, ...

### Footer
- Section breadcrumb is already correct from scaffold
- Package name is already correct

### Code string constants
Static hoist ALL code examples at the top of the file:
```typescript
const INSTALL_CODE = `import { ... } from '@reactjit/privacy'`;

const ENCRYPT_CODE = `const encrypted = useEncrypt(plaintext, {
  algorithm: 'aes-256-gcm',
})`;

const POLICY_CODE = `<PolicyBadge
  policy="no-share"
  label="Private"
/>`;
```

### Icon choices for SectionLabel
Pick icons that match the feature being documented:
- Crypto/security: `shield`, `lock`, `key`, `fingerprint`
- Data/storage: `database`, `hard-drive`, `save`
- Network/API: `globe`, `wifi`, `cloud`
- Audio/media: `music`, `volume-2`, `mic`
- Config/options: `settings`, `sliders`, `toggle-left`
- Performance: `zap`, `gauge`, `timer`
- Code/dev: `code`, `terminal`, `braces`
- General: `download` (install), `layers` (provider), `info` (callout)

## Step 4: Validate

```bash
cd storybook && rjit lint
```

Fix any lint errors before considering the story done.

## Rules

- Import primitives from `'../../../packages/core/src'` — never `@reactjit/core`
- Import theme from `'../../../packages/theme/src'`
- Import the actual package hook from `'../../../packages/<pkg>/src'`
- Always `useThemeColors()` — never hardcode hex colors (except the accent palette `C`)
- Export must be named `<Name>Story`
- Static hoist ALL code strings and style objects outside the component
- **Every major feature MUST have a live demo component** that calls the real hook
- Demo components are separate named functions with `// ── Name ───` comment banners
- Demos use useState + useEffect, always handle errors, show input → output flow
- Use colored labels per result type: `c.info`, `c.success`, `c.warning`, `c.accent`
- Add interactive elements (Pressable buttons) when the feature supports regeneration
- Add a FeatureList/catalog section for packages with many algorithms/options
- Add a UsageExamples section with static CodeBlocks AFTER the live demos
- Keep each demo focused — one feature per demo, not the entire package
- Use `alignItems: 'start'` not `'flex-start'` (ReactJIT non-standard values)

## Story structure (CryptoStory pattern)

The recommended structure follows CryptoStory — StoryPage with StorySection per feature:

```
+-------------------------------------------+
| StorySection: "@reactjit/pkg"             |  Title + tagline
|   one-liner description                   |
+-------------------------------------------+
| StorySection: "Feature A"                 |  Live demo
|   FeatureADemo()                          |  (calls real hook, shows output)
+-------------------------------------------+
| StorySection: "Feature B"                 |  Live demo
|   FeatureBDemo()                          |  (interactive, with buttons)
+-------------------------------------------+
| StorySection: "Feature C"                 |  Live demo
|   FeatureCDemo()                          |  (input → output + validation)
+-------------------------------------------+
| StorySection: "Algorithm Catalog"         |  FeatureList (optional)
|   dot + label + description per item      |
+-------------------------------------------+
| StorySection: "Usage Examples"            |  Static CodeBlocks
|   CodeBlock per API pattern               |
+-------------------------------------------+
```

## Layout2 zigzag reference (alternative format)

```
+-------------------------------------------+
| [pkg] Title  [@reactjit/x]  description   |  Header
+-------------------------------------------+
| | Hero pitch (bold)                        |  accent stripe left border
| | Overview text (muted)                    |
+-------------------------------------------+
| Text side      |  LiveDemo                |  Band: text | demo
| [icon] LABEL   |  (real hook output)      |
| explanation    |                           |
+-------------------------------------------+
| CodeBlock      |  Text side               |  Band: code | text (zigzag)
| ```code```     |  [icon] LABEL            |
|                |  explanation              |
+-------------------------------------------+
| [i] Callout text across full width        |  Callout band
+-------------------------------------------+
| [folder] Section / [pkg] Name     v0.1.0  |  Footer
+-------------------------------------------+
```

## What NOT to do

- **NEVER** create a shared wrapper component for Layout2 stories
- **NEVER** create strings/objects inside the component body — hoist everything
- **NEVER** use `alignItems: 'flex-start'` — use `'start'`
- **NEVER** import from `@reactjit/core` — use relative paths from storybook
- **NEVER** hardcode colors — use `useThemeColors()` tokens + the `C` accent palette
- **NEVER** skip live demos — static CodeBlocks alone are not enough for major features
- **NEVER** make a demo that doesn't actually call the real hook — fake/mock data defeats the purpose
