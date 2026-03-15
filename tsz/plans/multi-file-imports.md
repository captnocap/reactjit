# Multi-File Imports for .tsz

## Why This Is a Blocker

Without multi-file imports, every .tsz app is a **god file**. The devtools plan needs
5+ component files composing into one root. The compile-runtime plan needs N source files
compiling to one `.gen.zig`. Both are blocked without this.

Currently: `collectComponents()` only finds functions in the same file. There is NO
import parsing. `ComponentInfo.body_pos` is a token index into the single source file's
token stream.

## What the User Writes

```tsx
// components/StatusBar.tsz
function StatusBar() {
  return (
    <Box style={{ height: 22, backgroundColor: '#0a0a16' }}>
      <Text fontSize={11} color="#4ec9b0">{`FPS: ${fps}`}</Text>
    </Box>
  );
}

// components/PerfTab.tsz
import { Sparkline } from './Sparkline';

function PerfTab() {
  return (
    <Box style={{ padding: 8 }}>
      <Sparkline />
      <Text fontSize={12} color="#888888">Performance</Text>
    </Box>
  );
}

// DevtoolsRoot.tsz
import { StatusBar } from './components/StatusBar';
import { PerfTab } from './components/PerfTab';

function App() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      {tab == 0 && <PerfTab />}
      <StatusBar />
    </Box>
  );
}
```

## How It Works: Token Stream Concatenation

The simplest approach that builds on what exists. No AST, no module system, no
separate compilation. Just: **read imported files, lex them, prepend their tokens
to the main file's token stream**. Then `collectComponents()` finds all functions
across all files naturally.

### The pipeline

```
1. Lex main file → tokens
2. Scan tokens for `import` statements → extract file paths
3. For each imported file:
   a. Resolve path relative to main file
   b. Read the file
   c. Lex it → more tokens
   d. Recursively scan for ITS imports (transitive)
4. Concatenate all tokens: [imported1] [imported2] ... [main]
5. Run existing codegen on the merged token stream
```

`collectComponents()` already scans ALL tokens for `function Name()` — if the
imported tokens are prepended, it finds them automatically. `ComponentInfo.body_pos`
points into the merged stream. The rest of codegen works unchanged.

### Why prepend, not append?

Components must be defined before they're used (JSX parser looks up component
names during `parseJSXElement`). Prepending imported files ensures their function
definitions appear before the main file's `App()` function.

## Implementation

### Step 1: Import Statement Detection

**File: `tsz/compiler/codegen.zig`**

Add `collectImports()` — called BEFORE lexing or as a pre-pass on raw source text.

Actually, simpler: scan the **already-lexed** token stream for import patterns:

```
import { Name } from './path'
import { Name1, Name2 } from './path'
```

Token pattern:
```
identifier("import") lbrace identifier comma? rbrace identifier("from") string
```

```zig
const MAX_IMPORTS = 32;

const ImportInfo = struct {
    path: []const u8,        // resolved file path
    names: [8][]const u8,    // imported names
    name_count: u8,
};

fn collectImports(self: *Generator) void {
    self.pos = 0;
    while (self.pos < self.lex.count and self.curKind() != .eof) {
        if (self.isIdent("import")) {
            self.advance_token(); // import
            if (self.curKind() == .lbrace) {
                self.advance_token(); // {
                // Collect names
                var names: [8][]const u8 = undefined;
                var count: u8 = 0;
                while (self.curKind() == .identifier and count < 8) {
                    names[count] = self.curText();
                    count += 1;
                    self.advance_token();
                    if (self.curKind() == .comma) self.advance_token();
                }
                if (self.curKind() == .rbrace) self.advance_token(); // }
                if (self.isIdent("from")) {
                    self.advance_token(); // from
                    if (self.curKind() == .string) {
                        const raw = self.curText();
                        const path = raw[1..raw.len - 1]; // strip quotes
                        // Resolve relative to input file
                        const resolved = resolvePath(self.input_file, path);
                        // Store import
                        self.imports[self.import_count] = .{
                            .path = resolved,
                            .names = names,
                            .name_count = count,
                        };
                        self.import_count += 1;
                    }
                }
            }
        }
        self.advance_token();
    }
}
```

### Step 2: File Reading + Lexing

**File: `tsz/compiler/main.zig`** (the CLI orchestrator)

After lexing the main file but before calling `generator.generate()`:

```zig
// 1. Lex main file
var lexer = Lexer.init(source);
lexer.tokenize();

// 2. Quick scan for imports (just string matching on source text)
var import_paths = findImportPaths(source, input_file);

// 3. For each import, read + lex
var all_tokens: [MAX_TOTAL_TOKENS]Token = undefined;
var total_count: u32 = 0;

for (import_paths) |imp| {
    const imp_source = std.fs.cwd().readFileAlloc(allocator, imp.path, 1 << 20) catch continue;
    var imp_lexer = Lexer.init(imp_source);
    imp_lexer.tokenize();
    // Prepend to merged stream
    @memcpy(all_tokens[total_count..total_count + imp_lexer.count], imp_lexer.tokens[0..imp_lexer.count]);
    total_count += imp_lexer.count;
    // Recursively check for THEIR imports too
}

// 4. Append main file tokens
@memcpy(all_tokens[total_count..total_count + lexer.count], lexer.tokens[0..lexer.count]);
total_count += lexer.count;

// 5. Create generator with merged token stream
var gen = Generator.init(allocator, &merged_lexer, merged_source, input_file);
```

### Step 3: Source Text Concatenation

The token stream references offsets into source text. When merging multiple files,
we need a merged source text too:

```zig
// Concatenate sources with separators
var merged_source = std.ArrayList(u8).init(allocator);
for (import_sources) |src| {
    const offset = merged_source.items.len;
    merged_source.appendSlice(src);
    merged_source.append('\n');
    // Adjust token start/end offsets by this offset
}
merged_source.appendSlice(main_source);
```

Token `start` and `end` fields need to be adjusted by the source offset of their file.

### Step 4: Path Resolution

Resolve `'./StatusBar'` relative to the importing file:

```zig
fn resolvePath(importer: []const u8, import_path: []const u8) []const u8 {
    // Strip .tsz extension if not present, add it
    // Resolve relative to importer's directory
    const dir = std.fs.path.dirname(importer) orelse ".";
    const with_ext = if (std.mem.endsWith(u8, import_path, ".tsz"))
        import_path else concat(import_path, ".tsz");
    return std.fs.path.resolve(allocator, &.{ dir, with_ext });
}
```

Supports:
- `'./StatusBar'` → `./StatusBar.tsz` (relative, auto-add .tsz)
- `'./components/PerfTab'` → `./components/PerfTab.tsz` (subdirectory)
- `'../shared/Theme'` → `../shared/Theme.tsz` (parent directory)

### Step 5: Transitive Imports

Imported files can import other files. Process recursively with cycle detection:

```zig
var visited: [MAX_IMPORTS][]const u8 = undefined;
var visited_count: u32 = 0;

fn processImports(path: []const u8) void {
    // Check cycle
    for (visited[0..visited_count]) |v| {
        if (std.mem.eql(u8, v, path)) return; // already processed
    }
    visited[visited_count] = path;
    visited_count += 1;

    const source = readFile(path);
    var lexer = Lexer.init(source);
    lexer.tokenize();

    // Find this file's imports and process them FIRST (depth-first)
    const sub_imports = findImportPaths(source, path);
    for (sub_imports) |sub| {
        processImports(sub.path); // recursive
    }

    // Then append this file's tokens to the merged stream
    appendTokens(lexer);
}
```

Depth-first ensures dependencies are defined before dependents.

### Step 6: Classifier Imports (.cls.tsz)

`.cls.tsz` files contain only `classifier({...})` blocks — no functions, no JSX.
They're processed the same way: lex, prepend tokens. `collectClassifiers()` in
codegen already scans all tokens for `classifier(` — it finds them in the merged
stream automatically.

```tsx
// style.cls.tsz
classifier({
  PanelHeader: { type: 'Box', style: { height: 28, backgroundColor: '#0a0a16' } },
  TabButton: { type: 'Pressable', style: { paddingLeft: 12, paddingRight: 12 } },
})

// DevtoolsRoot.tsz
import { PanelHeader, TabButton } from './style.cls';
// ^ .cls.tsz extension auto-resolved

function App() {
  return (
    <C.PanelHeader>
      <C.TabButton onPress={() => setTab(0)}>
        <Text>Perf</Text>
      </C.TabButton>
    </C.PanelHeader>
  );
}
```

## What Does NOT Need to Change

- `collectComponents()` — already scans full token stream
- `collectClassifiers()` — already scans full token stream
- `collectStateHooks()` — scans from App function only (correct)
- `collectEffects()` — scans from App function only (correct)
- `parseJSXElement()` — looks up component names against collected components (correct)
- `emitZigSource()` — emits from collected data (correct)

The ONLY new code is: import parsing, file reading, token/source concatenation, path resolution.

## Files

| File | Change |
|------|--------|
| `tsz/compiler/main.zig` | Read imported files, lex them, build merged token stream |
| `tsz/compiler/codegen.zig` | Add `collectImports()` to parse import statements (or skip them as comments during codegen) |
| `tsz/compiler/lexer.zig` | No changes needed — lexes any .tsz source |

## Verification

```bash
# Create two files
echo 'function Greeting() {
  return <Text fontSize={24} color="#ffffff">Hello from another file!</Text>;
}' > /tmp/Greeting.tsz

echo 'import { Greeting } from "./Greeting";

function App() {
  return (
    <Box style={{ padding: 32, backgroundColor: "#1e1e2a", width: "100%", height: "100%" }}>
      <Greeting />
      <Text fontSize={14} color="#888888">Main file text</Text>
    </Box>
  );
}' > /tmp/app.tsz

# Build
tsz build /tmp/app.tsz

# Should compile with Greeting inlined from the other file
```

## Why Token Concatenation (Not Separate Compilation)

Separate compilation (compile each file to its own .zig module, wire imports) would be
more "correct" but massively more complex:
- State slot allocation across modules
- Cross-module component references
- Separate node trees that need merging
- Import/export symbol tables

Token concatenation is dumb and simple: smash all the tokens together, let the existing
single-file compiler process them. It works because .tsz components are inlined at compile
time anyway — there's no runtime import mechanism. This matches how the Love2D .tslx
compiler worked too.
