# ReactJIT Docs: Content-First Architecture

## Core Principle

**Write plaintext content files once, render to all mediums (plaintext for /llms.txt, React components for visual docs).**

Single source of truth → Multiple renderings.

---

## Project Structure

### **New Approach: Content First**

```
reactjit-docs/
├── content/                        # ← SINGLE SOURCE OF TRUTH (plaintext)
│   ├── sections/
│   │   ├── 01-getting-started/
│   │   │   ├── index.txt
│   │   │   ├── philosophy.txt
│   │   │   ├── installation.txt
│   │   │   ├── quick-start.txt
│   │   │   └── first-app.txt
│   │   │
│   │   ├── 02-architecture/
│   │   │   ├── index.txt
│   │   │   ├── pipeline.txt
│   │   │   ├── reconciler.txt
│   │   │   ├── layout-engine.txt
│   │   │   ├── transport.txt
│   │   │   ├── painter.txt
│   │   │   └── source-of-truth.txt
│   │   │
│   │   ├── 03-cli-reference/
│   │   │   ├── index.txt
│   │   │   ├── init.txt
│   │   │   ├── dev.txt
│   │   │   ├── build.txt
│   │   │   ├── update.txt
│   │   │   ├── lint.txt
│   │   │   └── screenshot.txt
│   │   │
│   │   ├── 04-layout-system/
│   │   │   ├── index.txt
│   │   │   ├── flexbox.txt
│   │   │   ├── sizing.txt
│   │   │   ├── spacing.txt
│   │   │   ├── visual.txt
│   │   │   ├── text.txt
│   │   │   ├── transforms.txt
│   │   │   └── critical-rules.txt
│   │   │
│   │   ├── 05-components/
│   │   │   ├── index.txt
│   │   │   ├── box.txt
│   │   │   ├── text.txt
│   │   │   ├── image.txt
│   │   │   ├── pressable.txt
│   │   │   ├── scrollview.txt
│   │   │   ├── textinput.txt
│   │   │   ├── modal.txt
│   │   │   ├── slider.txt
│   │   │   ├── switch.txt
│   │   │   ├── checkbox.txt
│   │   │   ├── radio.txt
│   │   │   ├── select.txt
│   │   │   ├── table.txt
│   │   │   ├── barchart.txt
│   │   │   ├── progressbar.txt
│   │   │   ├── sparkline.txt
│   │   │   ├── breadcrumbs.txt
│   │   │   ├── navpanel.txt
│   │   │   ├── tabs.txt
│   │   │   ├── toolbar.txt
│   │   │   ├── flatlist.txt
│   │   │   └── texteditor.txt
│   │   │
│   │   ├── 06-hooks/
│   │   │   ├── index.txt
│   │   │   ├── usestate.txt
│   │   │   ├── useeffect.txt
│   │   │   ├── usecontext.txt
│   │   │   ├── usereducer.txt
│   │   │   ├── useref.txt
│   │   │   ├── useanimation.txt
│   │   │   └── usespring.txt
│   │   │
│   │   ├── 07-animation/
│   │   │   ├── index.txt
│   │   │   ├── useanimation.txt
│   │   │   ├── usespring.txt
│   │   │   ├── easing.txt
│   │   │   ├── composite.txt
│   │   │   └── recipes.txt
│   │   │
│   │   ├── 08-routing/
│   │   │   ├── index.txt
│   │   │   ├── overview.txt
│   │   │   ├── userouter.txt
│   │   │   ├── usenavigate.txt
│   │   │   ├── useparams.txt
│   │   │   └── examples.txt
│   │   │
│   │   ├── 09-targets/
│   │   │   ├── index.txt
│   │   │   ├── love2d.txt
│   │   │   ├── web.txt
│   │   │   ├── terminal.txt
│   │   │   ├── computercraft.txt
│   │   │   ├── neovim.txt
│   │   │   ├── hammerspoon.txt
│   │   │   └── awesomewm.txt
│   │   │
│   │   ├── 10-advanced/
│   │   │   ├── index.txt
│   │   │   ├── lua-runtime.txt
│   │   │   ├── reconciler.txt
│   │   │   ├── event-handling.txt
│   │   │   ├── performance.txt
│   │   │   ├── debugging.txt
│   │   │   └── custom-targets.txt
│   │   │
│   │   ├── 11-troubleshooting/
│   │   │   ├── index.txt
│   │   │   ├── common-errors.txt
│   │   │   └── faq.txt
│   │   │
│   │   └── 12-api-reference/
│   │       ├── index.txt
│   │       ├── components.txt
│   │       ├── hooks.txt
│   │       ├── types.txt
│   │       ├── style-properties.txt
│   │       └── cli.txt
│   │
│   ├── metadata.json            # Section metadata, ordering, search keywords
│   └── examples/                # Embedded code examples (also plaintext)
│       ├── hello-world.txt
│       ├── counter.txt
│       ├── todo-app.txt
│       ├── dashboard.txt
│       └── animation-demo.txt
│
├── src/                         # Rendering code (reads content/)
│   ├── content-parser/          # Parse .txt files
│   │   ├── parser.ts            # Main parser
│   │   ├── types.ts             # Parsed content types
│   │   └── utils.ts             # Helper utilities
│   │
│   ├── renderers/               # Render parsed content to different formats
│   │   ├── plaintext.ts         # → /llms.txt (plaintext)
│   │   ├── react.ts             # → React components
│   │   └── html.ts              # → Static HTML (optional)
│   │
│   ├── components/              # React UI components (shared)
│   │   ├── Navigation.tsx
│   │   ├── Sidebar.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── ContentPage.tsx      # Main content renderer
│   │   └── ...
│   │
│   ├── targets/                 # Target-specific entry points
│   │   ├── web-main.tsx
│   │   ├── love2d-main.tsx
│   │   ├── terminal-main.tsx
│   │   ├── cc-main.tsx
│   │   ├── nvim-main.tsx
│   │   ├── hs-main.tsx
│   │   └── awesome-main.tsx
│   │
│   └── llms/                    # /llms.txt routing
│       ├── server.ts            # HTTP server
│       └── index.tsx            # Route handlers
│
├── scripts/
│   ├── build-docs.ts            # Parse content + render to all formats
│   ├── extract-api.ts           # Extract API from reactjit source
│   ├── validate-content.ts      # Validate .txt files
│   └── generate-search.ts       # Build search indices
│
└── dist/
    ├── llms/                    # Generated /llms.txt files
    │   ├── llms.txt
    │   ├── api.txt
    │   ├── components.txt
    │   └── ...
    │
    └── parsed/                  # Parsed JSON (intermediate)
        └── sections.json
```

---

## Content File Format

### **Specification: .txt File Format**

Each `.txt` file in `content/sections/` follows this structure:

```
=== METADATA ===
title: Component or Topic Name
description: One-line summary
category: Category Name
platforms: love2d, web, terminal, cc, nvim, hs, awesome
keywords: keyword1, keyword2, keyword3
related: OtherComponent, AnotherHook
difficulty: beginner|intermediate|advanced

=== OVERVIEW ===
[1-2 paragraph description of what this is and why you'd use it]

=== API / SYNTAX ===
[API signature, method signature, props table, etc.]

[For components]:
Props:
  propName (Type, optional): Description of what it does
  anotherProp (Type, required): Description

[For hooks]:
Signature: hookName(param: Type) → ReturnType
Parameters:
  param: Description
Returns:
  value: Description of return value

=== EXAMPLES ===
Example 1: Description
---
<Component prop="value" />
---
Platforms: web, love2d, terminal

Example 2: More Complex Example
---
const [state, setState] = useState(0);
return <Component state={state} onChange={setState} />;
---
Platforms: All

=== PLATFORM NOTES ===
Web:
  • Uses CSS Flexbox
  • Responsive design

Love2D:
  • Uses Lua flexbox engine
  • Pixel-perfect rendering

Terminal:
  • Grid-based layout
  • Character constraints

=== COMMON PATTERNS ===
[Real-world usage patterns]

=== PERFORMANCE ===
[Performance considerations, optimization tips]

=== SEE ALSO ===
- RelatedComponent
- AnotherHook
- LayoutConcept
```

### **Example: components/box.txt**

```
=== METADATA ===
title: Box
description: Flexible layout container using Flexbox
category: Primitives
platforms: love2d, web, terminal, cc, nvim, hs, awesome
keywords: layout, container, flexbox, flex, grid
related: Text, Image, Pressable
difficulty: beginner

=== OVERVIEW ===
Box is the fundamental layout component in ReactJIT. It uses Flexbox to arrange children
in rows or columns, with full control over sizing, spacing, and alignment.

The Box component is your go-to for building any kind of layout. Everything is a Box,
and understanding Box is understanding ReactJIT layouts.

=== API / SYNTAX ===
<Box style={boxStyle} onPress={handler}>{children}</Box>

Props:
  style (Style, optional): Flexbox and visual styling
  children (ReactNode, optional): Child components
  onPress (function, optional): Click handler
  key (string, optional): React key for lists

=== EXAMPLES ===
Example 1: Basic Container
---
<Box style={{ width: 200, height: 100, backgroundColor: '#f0f0f0' }} />
---
Platforms: All

Example 2: Flex Row (Horizontal)
---
<Box style={{ flexDirection: 'row', gap: 10, padding: 16 }}>
  <Box style={{ flex: 1, backgroundColor: 'red' }} />
  <Box style={{ flex: 1, backgroundColor: 'blue' }} />
</Box>
---
Platforms: All

Example 3: Flex Column (Vertical)
---
<Box style={{ gap: 8, padding: 16 }}>
  <Text style={{ fontSize: 14 }}>Header</Text>
  <Box style={{ flexGrow: 1, backgroundColor: '#eee' }} />
  <Text style={{ fontSize: 12 }}>Footer</Text>
</Box>
---
Platforms: All

=== PLATFORM NOTES ===
Web:
  • Uses CSS Flexbox natively
  • All CSS properties supported
  • Responsive design via media queries

Love2D:
  • Uses Lua flexbox engine
  • Pixel-perfect layout
  • No responsive, fixed canvas size

Terminal:
  • Grid-based layout
  • Character cells
  • No sub-pixel sizing

=== COMMON PATTERNS ===
Center content:
<Box style={{ justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
  <Content />
</Box>

Sidebar layout:
<Box style={{ flexDirection: 'row' }}>
  <Sidebar style={{ width: 200 }} />
  <Box style={{ flexGrow: 1 }}>
    <Content />
  </Box>
</Box>

=== CRITICAL RULES ===
• Root containers MUST have width: '100%' and height: '100%'
• Use explicit sizing for predictable layouts
• flexGrow requires parent sizing context
• Avoid deep nesting of flex containers

=== SEE ALSO ===
- Text
- Pressable
- ScrollView
- Layout System guide
- Flexbox Rules
```

---

## Build Pipeline

### **Step 1: Parse Content**

```typescript
// scripts/build-docs.ts
import { parseContentDirectory } from './src/content-parser/parser';
import { renderToPlaintext } from './src/renderers/plaintext';
import { renderToReact } from './src/renderers/react';
import { writeFileSync, mkdirSync } from 'fs';

async function buildAllDocs(): Promise<void> {
  // 1. Parse all .txt files in content/
  const parsed = await parseContentDirectory('./content/sections');

  // 2. Generate /llms.txt files (plaintext)
  mkdirSync('./dist/llms', { recursive: true });
  for (const [section, content] of Object.entries(parsed)) {
    const plaintext = renderToPlaintext(content);
    writeFileSync(`./dist/llms/${section}.txt`, plaintext);
  }

  // 3. Generate React components (for visual docs)
  mkdirSync('./dist/parsed', { recursive: true });
  const reactComponents = renderToReact(parsed);
  writeFileSync('./dist/parsed/sections.json', JSON.stringify(reactComponents, null, 2));

  // 4. Generate search indices
  const searchIndex = buildSearchIndex(parsed);
  writeFileSync('./dist/llms/search-index.json', JSON.stringify(searchIndex));

  console.log('✓ Built docs from content/');
  console.log('✓ Generated /llms.txt files');
  console.log('✓ Generated React components');
  console.log('✓ Generated search indices');
}

buildAllDocs();
```

### **Step 2: Content Parser**

```typescript
// src/content-parser/parser.ts
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface ParsedContent {
  metadata: {
    title: string;
    description: string;
    category: string;
    platforms: string[];
    keywords: string[];
    related: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
  sections: {
    overview: string;
    api: string;
    examples: Array<{
      title: string;
      code: string;
      platforms: string[];
    }>;
    platformNotes: Record<string, string>;
    commonPatterns: string;
    performance: string;
    criticalRules?: string[];
    seeAlso: string[];
  };
}

export async function parseContentDirectory(
  contentDir: string
): Promise<Record<string, ParsedContent>> {
  const sections = readdirSync(contentDir);
  const parsed: Record<string, ParsedContent> = {};

  for (const section of sections) {
    const sectionPath = join(contentDir, section);
    const files = readdirSync(sectionPath).filter(f => f.endsWith('.txt'));

    for (const file of files) {
      const filePath = join(sectionPath, file);
      const content = readFileSync(filePath, 'utf-8');
      const key = `${section}/${file.replace('.txt', '')}`;

      parsed[key] = parseContentFile(content);
    }
  }

  return parsed;
}

function parseContentFile(content: string): ParsedContent {
  const sections = content.split(/^=== (\w+(?:\s+\w+)*) ===/m);
  const metadata = parseMetadata(sections[1] || '');

  return {
    metadata,
    sections: {
      overview: extractSection(sections, 'OVERVIEW'),
      api: extractSection(sections, 'API / SYNTAX'),
      examples: parseExamples(extractSection(sections, 'EXAMPLES')),
      platformNotes: parsePlatformNotes(extractSection(sections, 'PLATFORM NOTES')),
      commonPatterns: extractSection(sections, 'COMMON PATTERNS'),
      performance: extractSection(sections, 'PERFORMANCE'),
      criticalRules: parseBulletList(extractSection(sections, 'CRITICAL RULES')),
      seeAlso: parseBulletList(extractSection(sections, 'SEE ALSO')),
    }
  };
}

function parseMetadata(text: string): ParsedContent['metadata'] {
  const lines = text.trim().split('\n');
  const result: any = {};

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();

    if (key === 'platforms' || key === 'keywords' || key === 'related') {
      result[key] = value.split(',').map(s => s.trim());
    } else {
      result[key] = value;
    }
  }

  return result;
}

function extractSection(sections: string[], name: string): string {
  const index = sections.indexOf(name);
  return index >= 0 ? sections[index + 1].trim() : '';
}

function parseExamples(
  text: string
): Array<{ title: string; code: string; platforms: string[] }> {
  const examples: any[] = [];
  const parts = text.split(/^Example \d+: /m);

  for (const part of parts.slice(1)) {
    const lines = part.trim().split('\n');
    const title = lines[0];
    const codeStart = lines.findIndex(l => l === '---');
    const codeEnd = lines.findIndex((l, i) => i > codeStart && l === '---');

    const code = lines.slice(codeStart + 1, codeEnd).join('\n');
    const platformLine = lines.find(l => l.startsWith('Platforms:'));
    const platforms = platformLine
      ? platformLine.replace('Platforms:', '').split(',').map(s => s.trim())
      : [];

    examples.push({ title, code, platforms });
  }

  return examples;
}

// ... other parsing functions
```

### **Step 3: Render to Plaintext (/llms.txt)**

```typescript
// src/renderers/plaintext.ts
import { ParsedContent } from '../content-parser/parser';

export function renderToPlaintext(content: ParsedContent): string {
  let output = '';

  // Header
  output += `========================================\n`;
  output += `${content.metadata.title}\n`;
  output += `========================================\n\n`;

  // Metadata
  output += `Category: ${content.metadata.category}\n`;
  output += `Difficulty: ${content.metadata.difficulty}\n`;
  output += `Platforms: ${content.metadata.platforms.join(', ')}\n`;
  output += `Keywords: ${content.metadata.keywords.join(', ')}\n\n`;

  // Description
  output += `${content.metadata.description}\n\n`;

  // Overview
  output += `---------\n`;
  output += `OVERVIEW\n`;
  output += `---------\n\n`;
  output += `${content.sections.overview}\n\n`;

  // API
  output += `---------\n`;
  output += `API / SYNTAX\n`;
  output += `---------\n\n`;
  output += `${content.sections.api}\n\n`;

  // Examples
  output += `---------\n`;
  output += `EXAMPLES\n`;
  output += `---------\n\n`;
  for (const example of content.sections.examples) {
    output += `EXAMPLE: ${example.title}\n`;
    output += `--------\n`;
    output += `${example.code}\n`;
    output += `--------\n`;
    output += `Platforms: ${example.platforms.join(', ')}\n\n`;
  }

  // Platform notes
  if (Object.keys(content.sections.platformNotes).length > 0) {
    output += `---------\n`;
    output += `PLATFORM NOTES\n`;
    output += `---------\n\n`;
    for (const [platform, notes] of Object.entries(content.sections.platformNotes)) {
      output += `${platform}:\n${notes}\n\n`;
    }
  }

  // Common patterns
  if (content.sections.commonPatterns) {
    output += `---------\n`;
    output += `COMMON PATTERNS\n`;
    output += `---------\n\n`;
    output += `${content.sections.commonPatterns}\n\n`;
  }

  // Critical rules
  if (content.sections.criticalRules?.length) {
    output += `---------\n`;
    output += `CRITICAL RULES\n`;
    output += `---------\n\n`;
    for (const rule of content.sections.criticalRules) {
      output += `• ${rule}\n`;
    }
    output += '\n';
  }

  // See also
  if (content.sections.seeAlso.length) {
    output += `---------\n`;
    output += `SEE ALSO\n`;
    output += `---------\n\n`;
    for (const item of content.sections.seeAlso) {
      output += `• ${item}\n`;
    }
    output += '\n';
  }

  return output;
}
```

### **Step 4: Render to React Components**

```typescript
// src/renderers/react.ts
import { ParsedContent } from '../content-parser/parser';

export function renderToReact(parsed: Record<string, ParsedContent>) {
  const components: Record<string, any> = {};

  for (const [key, content] of Object.entries(parsed)) {
    components[key] = {
      metadata: content.metadata,
      Component: createReactComponent(content),
      plaintext: renderToPlaintext(content)
    };
  }

  return components;
}

function createReactComponent(content: ParsedContent) {
  return ({ props }: any) => `
    <ContentPage
      title="${content.metadata.title}"
      description="${content.metadata.description}"
      metadata={${JSON.stringify(content.metadata)}}
    >
      <Section title="Overview">
        ${content.sections.overview}
      </Section>

      <Section title="API">
        <APIBlock content="${content.sections.api}" />
      </Section>

      <Section title="Examples">
        ${content.sections.examples.map(ex => `
          <Example title="${ex.title}" platforms={${JSON.stringify(ex.platforms)}}>
            <CodeBlock code={\`${ex.code}\`} />
          </Example>
        `).join('\n')}
      </Section>

      ${content.sections.platformNotes ? `
        <Section title="Platform Notes">
          <PlatformNotes notes={${JSON.stringify(content.sections.platformNotes)}} />
        </Section>
      ` : ''}
    </ContentPage>
  `;
}
```

---

## Workflow

### **Writing New Documentation**

1. **Create `.txt` file in `content/sections/`**
   ```
   content/sections/05-components/newcomponent.txt
   ```

2. **Write content following the format** (metadata + sections)

3. **Build docs**
   ```bash
   npm run build:docs
   ```

4. **Outputs generated automatically:**
   - `/llms/05-components-newcomponent.txt` (plaintext)
   - React component for visual docs
   - Search index updated
   - All 7 targets updated

### **Editing Existing Documentation**

1. **Edit the `.txt` file directly** (single source of truth)
2. **Run build** → Everything updates automatically
3. **No duplication, no stale content**

---

## Build Commands

```bash
# Full build (all outputs)
npm run build:docs

# Just parse and validate
npm run validate:docs

# Generate /llms.txt files only
npm run generate:llms

# Generate React components only
npm run generate:react

# Watch mode (rebuild on changes)
npm run watch:docs

# Serve /llms.txt endpoints locally
npm run serve:llms
```

---

## Data Flow

```
content/sections/*.txt
    │
    ├→ Parser (parseContentDirectory)
    │
    ├→ Plaintext Renderer → dist/llms/*.txt
    │
    ├→ React Renderer → React components
    │
    ├→ Search Index Generator → dist/llms/search-index.json
    │
    ├→ Web build (Vite) → Love2D build → Terminal build → CC/Nvim/HS/Awesome
    │
    └→ All targets render same content, different UIs
```

---

## Key Benefits

✅ **Single Source of Truth** — One `.txt` file per topic
✅ **No Duplication** — Content written once, used everywhere
✅ **LLM-Ready Out of Box** — /llms.txt files are ready immediately
✅ **Easy to Maintain** — Edit plaintext, everything updates
✅ **Scalable** — Add new sections by adding `.txt` files
✅ **Content-First** — Writers focus on content, not markup
✅ **Multiple Outputs** — Same content → plaintext, React, search indices, HTML, etc.
✅ **Version Control Friendly** — Plaintext diffs are readable

---

## Example Build Output

When you run `npm run build:docs`:

```
✓ Parsed 180+ content files
✓ Generated /llms/01-getting-started.txt (5 KB)
✓ Generated /llms/02-architecture.txt (8 KB)
✓ Generated /llms/03-cli-reference.txt (6 KB)
...
✓ Generated /llms/llms.txt (250 KB) — Full documentation
✓ Generated search-index.json (45 KB)
✓ Generated React components (memory)
✓ Built web version
✓ Built Love2D version
✓ Built terminal version
✓ Built CC version
✓ Built Nvim version
✓ Built HS version
✓ Built Awesome version

Total: 500+ KB documentation across all platforms
Single source: 180 .txt files in content/
```

---

## Implementation Timeline

- **Week 1:** Set up content parser + renderers
- **Weeks 2-4:** Write all 180+ `.txt` files
- **Week 5:** Build visual renders, test all targets
- **Week 6:** Polish, deploy, launch

Everything flows from the `.txt` files — the master source.
