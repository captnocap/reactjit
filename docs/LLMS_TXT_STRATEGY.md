# /llms.txt Strategy for ReactJIT Documentation

## Overview

The `/llms.txt` system provides **LLM-optimized, plaintext access** to ReactJIT documentation through structured HTTP endpoints and static file exports. This enables AI agents to consume and understand the framework without needing to parse HTML or crawl web pages.

---

## Architecture

### **Endpoints**

All endpoints return **plaintext UTF-8 content** designed for LLM token efficiency.

```
GET /llms.txt                      # Full documentation
GET /llms/api.txt                  # API reference only
GET /llms/components.txt           # Component documentation
GET /llms/hooks.txt                # Hooks API
GET /llms/targets.txt              # Target-specific guides
GET /llms/troubleshooting.txt      # Troubleshooting & FAQ
GET /llms/cheatsheet.txt           # Quick reference
GET /llms/examples.txt             # Code examples
GET /llms/architecture.txt         # Architecture & concepts
GET /llms/cli.txt                  # CLI reference
GET /llms/layout.txt               # Layout system guide
GET /llms/search?q=query           # Full-text search (JSON response)
```

### **Implementation**

#### **1. Static Generation (Build-Time)**
- Generate `.txt` files during build process
- Include in all distributions (Love2D, Terminal, Web, etc.)
- Can be served statically or via HTTP
- Version alongside releases

#### **2. Dynamic Generation (Runtime)**
- HTTP server (Express/Hono) with endpoints
- Dynamic search via Lunr.js index
- Regenerate on content updates
- Cache aggressively (ETag, Last-Modified)

#### **3. Dual-Mode Approach (Recommended)**
- **Build:** Generate static files for distribution
- **Runtime:** Optional HTTP server for live updates
- Best of both worlds: offline + up-to-date

---

## Content Format

### **Design Principles**

1. **Token Efficiency** — Compact, no wasted characters
2. **Structure** — Clear sections, easy to parse
3. **Completeness** — All necessary information included
4. **Searchability** — Keywords for indexing
5. **LLM-Friendly** — Designed for token counting

### **Format Specification**

#### **Section Headers**
```
========================================
Section Title
========================================
```

#### **Subsections**
```
Subsection Name
---------
```

#### **Entry Format (Components, Hooks, etc.)**
```
ComponentName
  Category: Primitives
  Description: One-line description of what it does

  Props:
    - propName (Type): Description
    - anotherProp (Type, optional): Description

  Returns: Type description

  Examples:
    <ComponentName prop="value" />

  Notes:
    - Platform-specific notes
    - Performance tips
    - Common mistakes

  See Also: OtherComponent, AnotherHook
```

#### **Code Examples**
```
EXAMPLE: Description
--------
code here
with syntax
--------
Platforms: love2d, web, terminal
```

#### **Tables**
```
NAME                TYPE              REQUIRED    DESCRIPTION
propName            boolean           no          What it does
anotherProp         string            yes         Required prop
```

#### **Lists**
```
• Item 1
• Item 2
  ◦ Sub-item 2a
  ◦ Sub-item 2b
```

---

## File Structure

### **/llms.txt** (Full Documentation)

```
========================================
ReactJIT Documentation (LLM Edition)
========================================

Generated: 2024-02-11
Version: 0.1.0
Targets: love2d, web, terminal, cc, nvim, hs, awesome

TABLE OF CONTENTS
-----------------

1. Getting Started
2. Architecture
3. CLI Reference
4. Layout System
5. Components API
6. Hooks API
7. Animation
8. Routing
9. Targets
10. Advanced Topics
11. Troubleshooting
12. Examples
13. Quick Reference

[Each section includes full content with subsections]
```

### **/llms/api.txt** (API Reference)

```
========================================
ReactJIT API Reference
========================================

COMPONENTS
----------

Box
  Category: Primitives
  Description: Flexible layout container
  Props:
    - style (Style, optional): Style object with flexbox properties
    - children (ReactNode, optional): Child elements
  Returns: Component
  Platforms: All

Text
  Category: Primitives
  Description: Text rendering component
  Props:
    - style (Style, required): Must include fontSize
    - children (string | ReactNode, required): Text content
  Returns: Component
  Platforms: All

[...all components...]

HOOKS
-----

useState
  Signature: useState<T>(initialValue: T) → [T, (T) => void]
  Description: React state hook
  Parameters:
    - initialValue: Initial state value
  Returns:
    - [value, setValue] tuple
  Platforms: All

[...all hooks...]
```

### **/llms/components.txt** (Component Guide)

```
========================================
ReactJIT Components Reference
========================================

PRIMITIVES
----------

Box
  Purpose: Flexible layout container using Flexbox
  [Full props table]
  [Examples]
  [Common patterns]
  [Target-specific notes]

Text
  Purpose: Text rendering
  [Full props table]
  [CRITICAL: fontSize required]
  [Examples]
  [Text wrapping behavior]

[...all components with detailed info...]
```

### **/llms/troubleshooting.txt** (FAQ & Errors)

```
========================================
Troubleshooting & FAQ
========================================

COMMON ERRORS
-------------

Error: Text is not rendering
  Symptoms: Text component appears blank
  Cause: Missing fontSize in style prop
  Solution: Add fontSize to style: { fontSize: 14 }
  Example: <Text style={{ fontSize: 14 }}>Hello</Text>

Error: flexGrow not working
  Symptoms: Component not filling available space
  Cause: Parent container doesn't have explicit size
  Solution: Add width/height to parent

[...all errors...]

FAQ
---

Q: Can I use npm packages?
A: Yes, via npm install and imports

Q: How do I debug on Love2D?
A: Use F12 to open visual inspector

[...all FAQs...]
```

### **/llms/cheatsheet.txt** (Quick Reference)

```
========================================
Quick Reference Cheatsheet
========================================

LAYOUT PROPERTIES
-----------------
width: <number | percentage | "100%">
height: <number | percentage | "100%">
padding: <number | [top, right, bottom, left]>
margin: <number | [top, right, bottom, left]>
gap: <number>
flexDirection: "row" | "column"
justifyContent: "flex-start" | "center" | "flex-end" | "space-between" | "space-around"
alignItems: "flex-start" | "center" | "flex-end" | "stretch"
flexGrow: <number>
flexShrink: <number>

COLORS
------
Named: "red", "blue", "white", "black", ...
Hex: "#FF0000"
RGB: [255, 0, 0]
RGBA: [255, 0, 0, 0.5]

COMPONENT QUICK LOOKUP
----------------------
<Box> — Container (flexbox)
<Text> — Text (requires fontSize)
<Image> — Images
<Pressable> — Clickable
<ScrollView> — Scrolling
<Slider> — Range input
<Modal> — Dialog
[...all components...]

HOOKS
-----
useState(initial) → [value, setValue]
useEffect(callback, deps) → cleanup
useSpring(value, config) → animatedValue
[...all hooks...]

CLI COMMANDS
------------
reactjit init <name>
reactjit dev
reactjit build [dist:love | dist:terminal]
reactjit lint
reactjit screenshot
reactjit update
```

### **/llms/examples.txt** (Code Examples)

```
========================================
ReactJIT Code Examples
========================================

HELLO WORLD
-----------

EXAMPLE: Basic text rendering
--------
import { Box, Text } from '@reactjit/core';

export default function App() {
  return (
    <Box style={{ width: '100%', height: '100%',
                   justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 32 }}>Hello, ReactJIT!</Text>
    </Box>
  );
}
--------
Platforms: All

INTERACTIVE APP
---------------

EXAMPLE: Counter with state
--------
import { useState } from 'react';
import { Box, Text, Pressable } from '@reactjit/core';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <Box style={{ gap: 16, padding: 16 }}>
      <Text style={{ fontSize: 24 }}>Count: {count}</Text>
      <Pressable onPress={() => setCount(count + 1)}>
        <Text style={{ fontSize: 14 }}>Increment</Text>
      </Pressable>
    </Box>
  );
}
--------
Platforms: All
```

---

## Generation Scripts

### **Script: Generate /llms.txt**

```typescript
// scripts/generate-llms.ts
import { readFileSync, writeFileSync } from 'fs';
import { extractAPIFromSource } from './utils/api-extractor';
import { renderComponentDoc } from './utils/doc-renderer';

interface DocumentSection {
  title: string;
  content: string;
  keywords: string[];
}

function generateLlmsDocs(outputDir: string): void {
  const sections: DocumentSection[] = [];

  // 1. Full documentation
  const fullDoc = generateFullDocumentation();
  writeFileSync(`${outputDir}/llms.txt`, fullDoc);

  // 2. API reference
  const apiDoc = generateAPIReference();
  writeFileSync(`${outputDir}/llms/api.txt`, apiDoc);

  // 3. Component reference
  const componentDoc = generateComponentReference();
  writeFileSync(`${outputDir}/llms/components.txt`, componentDoc);

  // 4. Hooks reference
  const hooksDoc = generateHooksReference();
  writeFileSync(`${outputDir}/llms/hooks.txt`, hooksDoc);

  // 5. Cheatsheet
  const cheatsheet = generateCheatsheet();
  writeFileSync(`${outputDir}/llms/cheatsheet.txt`, cheatsheet);

  // 6. Search index
  const searchIndex = buildSearchIndex(sections);
  writeFileSync(`${outputDir}/llms/search-index.json`,
    JSON.stringify(searchIndex, null, 2));

  console.log('✓ Generated /llms.txt documentation');
}

function generateFullDocumentation(): string {
  let doc = `========================================
ReactJIT Documentation (LLM Edition)
========================================

Generated: ${new Date().toISOString()}
Version: ${require('../package.json').version}

TABLE OF CONTENTS
-----------------\n\n`;

  // Include all sections
  const sections = [
    { title: 'Getting Started', file: 'getting-started.txt' },
    { title: 'Architecture', file: 'architecture.txt' },
    { title: 'CLI Reference', file: 'cli.txt' },
    { title: 'Layout System', file: 'layout.txt' },
    { title: 'Components', file: 'components.txt' },
    { title: 'Hooks', file: 'hooks.txt' },
    { title: 'Troubleshooting', file: 'troubleshooting.txt' },
  ];

  sections.forEach((section, i) => {
    doc += `${i + 1}. ${section.title}\n`;
    const content = readFileSync(`./docs/llms/${section.file}`, 'utf-8');
    doc += `\n========================================\n${section.title}\n========================================\n\n`;
    doc += content + '\n\n';
  });

  return doc;
}

function generateAPIReference(): string {
  // Extract API from source code
  const components = extractAPIFromSource('packages/shared/src/components');
  const hooks = extractAPIFromSource('packages/shared/src/hooks');

  let doc = `========================================
ReactJIT API Reference
========================================\n\n`;

  doc += 'COMPONENTS\n----------\n\n';
  components.forEach(comp => {
    doc += renderComponentDoc(comp) + '\n\n';
  });

  doc += 'HOOKS\n-----\n\n';
  hooks.forEach(hook => {
    doc += renderHookDoc(hook) + '\n\n';
  });

  return doc;
}

function buildSearchIndex(sections: DocumentSection[]) {
  // Build Lunr.js compatible search index
  return {
    version: 1,
    fields: ['title', 'content', 'keywords'],
    fieldVectors: {}, // Lunr fills this
    refs: sections.map(s => s.title),
    documentStore: {
      store: sections.reduce((acc, s) => {
        acc[s.title] = {
          title: s.title,
          keywords: s.keywords
        };
        return acc;
      }, {})
    }
  };
}

generateLlmsDocs('./dist/llms');
```

### **Script: Search Endpoint**

```typescript
// src/llms/search.ts
import Lunr from 'lunr';
import searchIndex from './search-index.json';

export interface SearchResult {
  title: string;
  keywords: string[];
  score: number;
  snippet: string;
}

export function searchDocs(query: string): SearchResult[] {
  const idx = Lunr.Index.load(searchIndex);
  const results = idx.search(query);

  return results
    .slice(0, 10)
    .map(result => ({
      title: result.ref,
      keywords: searchIndex.documentStore.store[result.ref].keywords,
      score: result.score,
      snippet: `Found in: ${result.ref}`
    }));
}
```

---

## HTTP Server Implementation

### **Express Implementation**

```typescript
// src/llms-server.ts
import express from 'express';
import { readFileSync } from 'fs';
import { searchDocs } from './llms/search';

const app = express();
const llmsDir = './dist/llms';

// Load .txt files
const fullDoc = readFileSync(`${llmsDir}/llms.txt`, 'utf-8');
const apiDoc = readFileSync(`${llmsDir}/api.txt`, 'utf-8');
const componentDoc = readFileSync(`${llmsDir}/components.txt`, 'utf-8');
const hooksDoc = readFileSync(`${llmsDir}/hooks.txt`, 'utf-8');
const targetDoc = readFileSync(`${llmsDir}/targets.txt`, 'utf-8');
const troubleshootingDoc = readFileSync(`${llmsDir}/troubleshooting.txt`, 'utf-8');
const cheatsheetDoc = readFileSync(`${llmsDir}/cheatsheet.txt`, 'utf-8');
const examplesDoc = readFileSync(`${llmsDir}/examples.txt`, 'utf-8');

// Endpoints
app.get('/llms.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(fullDoc);
});

app.get('/llms/api.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(apiDoc);
});

app.get('/llms/components.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(componentDoc);
});

app.get('/llms/hooks.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(hooksDoc);
});

app.get('/llms/targets.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(targetDoc);
});

app.get('/llms/troubleshooting.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(troubleshootingDoc);
});

app.get('/llms/cheatsheet.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(cheatsheetDoc);
});

app.get('/llms/examples.txt', (req, res) => {
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.send(examplesDoc);
});

app.get('/llms/search', (req, res) => {
  const q = req.query.q as string;
  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }

  const results = searchDocs(q);
  res.json({
    query: q,
    results,
    count: results.length
  });
});

app.listen(3000, () => {
  console.log('LLM docs server running on http://localhost:3000/llms.txt');
});
```

---

## Usage Examples

### **For LLMs (via HTTP)**

```python
# Python example
import requests

# Fetch API reference
response = requests.get('https://reactjit.dev/llms/api.txt')
api_doc = response.text

# Search for something
response = requests.get('https://reactjit.dev/llms/search?q=flexGrow')
results = response.json()
```

### **For Offline Docs**

```bash
# Download full documentation
curl https://reactjit.dev/llms.txt > reactjit-docs.txt

# Search locally
grep -i "flexgrow" reactjit-docs.txt
```

### **Integration with Claude/ChatGPT**

```
User: "How do I use flexGrow in ReactJIT?"

Claude: I'll check the ReactJIT documentation for you.
[Fetches /llms.txt or /llms/layout.txt]
Based on the documentation:
- flexGrow requires parent sizing context
- Example: <Box style={{ flexGrow: 1 }} />
...
```

---

## Distribution

### **Web Hosting**
- Primary: https://reactjit.dev/llms.txt
- API: https://reactjit.dev/llms/
- Fallback: GitHub raw content

### **Static Files**
- Include in all releases
- Love2D: In `/llms/` directory
- Terminal: In binary
- Web: Served from `/llms/`

### **npm Package**
- Publish as `@reactjit/docs`
- Include full `/llms.txt` in package
- Install: `npm install @reactjit/docs`

---

## Maintenance

### **Build Integration**
- Generate /llms.txt during `npm run build:all`
- Include in all target distributions
- Version with releases

### **Updates**
- Regenerate when documentation changes
- Update search indices
- CI/CD: Validate /llms.txt completeness

### **Versioning**
- Version /llms.txt alongside releases
- /llms/v1.0.0/ for version-specific docs
- Maintain backward compatibility

---

## Success Metrics

- ✅ /llms.txt serves within 200ms
- ✅ Search returns results in < 100ms
- ✅ All content is plaintext (< 5MB total)
- ✅ Token count < 50k for full doc
- ✅ Search index < 1MB
- ✅ Zero broken references
- ✅ LLM can understand and follow examples

---

## Future Enhancements

- [ ] Structured JSON variant (`/llms/structured.json`)
- [ ] OpenAPI specification export
- [ ] GraphQL schema endpoint
- [ ] Webhook notifications for content updates
- [ ] AI-generated summaries per section
- [ ] Auto-generated code completions
- [ ] Integration with LSP (Language Server Protocol)
