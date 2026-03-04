---
name: scaffold-package-story
description: "Scaffold and populate a Layout2-style documentation story for a ReactJIT package. Use when the user says '/scaffold-package-story PackageName', 'scaffold a package story for X', 'create a package doc for X', or wants a new hook/API documentation page in the storybook. Generates the file with zigzag narrative layout, then fills in real exports, hooks, usage examples, and gotchas."
---

# Scaffold Package Story

Generate a Layout2 documentation page for a ReactJIT package — hook/API-heavy packages
where a narrative walkthrough with embedded code examples makes more sense than an
interactive playground.

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

### Zigzag bands
One band per major export/hook/feature. Each band has:
- **SectionLabel** with icon + uppercase label (e.g., `icon="shield"` + `ENCRYPTION`)
- 1-2 sentence explanation of the feature
- Code block showing usage

The "code" side can be a `CodeBlock` OR a small inline demo component. For inline demos,
define the component as a separate function above the main export:

```tsx
function EncryptionDemo() {
  const c = useThemeColors();
  return (
    <Box style={{ backgroundColor: c.surface, padding: 12, borderRadius: 6 }}>
      <Text style={{ color: c.text, fontSize: 10 }}>{'Encrypted: ****'}</Text>
    </Box>
  );
}
```

Then use it in the band: `<EncryptionDemo />` instead of `<CodeBlock ... />`

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
- Always `useThemeColors()` — never hardcode hex colors (except the accent palette `C`)
- Export must be named `<Name>Story`
- Static hoist ALL code strings and style objects outside the component
- The "code" side of bands is flexible: `CodeBlock` OR inline demo component
- Define inline demo components as separate functions above the main export (same file)
- Keep demos small — show one feature, not the entire package
- Maintain zigzag rhythm: text|code alternates with code|text
- Use `alignItems: 'start'` not `'flex-start'` (ReactJIT non-standard values)

## Layout reference

```
+-------------------------------------------+
| [pkg] Title  [@reactjit/x]  description   |  Header
+-------------------------------------------+
| | Hero pitch (bold)                        |  accent stripe left border
| | Overview text (muted)                    |
+-------------------------------------------+
| Text side      |  CodeBlock               |  Band: text | code
| [icon] LABEL   |  ```code```              |
| explanation    |                           |
+-------------------------------------------+
| CodeBlock      |  Text side               |  Band: code | text (zigzag)
| ```code```     |  [icon] LABEL            |
|                |  explanation              |
+-------------------------------------------+
| [i] Callout text across full width        |  Callout band
+-------------------------------------------+
| Text side      |  CodeBlock               |  Band: text | code
+-------------------------------------------+
| CodeBlock      |  Text side               |  Band: code | text
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
