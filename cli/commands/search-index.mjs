/**
 * search-index.mjs — Compile-time text indexer for app search.
 *
 * Walks source .tsx files, finds all leaf <Text> nodes with static string
 * children (and text-bearing props like placeholder, label, description),
 * and emits dist/search-index.json.
 *
 * Each entry carries:
 *   id        — "file:line:col" — stable across text edits
 *   text      — the static string content
 *   file      — source file path (relative to cwd)
 *   line/col  — source location
 *   component — enclosing component function name
 *   context   — JSX ancestor breadcrumb (innermost first)
 *   storyId   — inferred from filename convention (SearchStory → search)
 *
 * The cold manifest powers cross-story search in the storybook and
 * pre-mount search in any app. At runtime, selecting a cold result
 * navigates to the target story/screen, then Lua walks the hot index
 * to highlight the exact node.
 *
 * Usage:
 *   rjit search-index                # indexes src/, writes dist/search-index.json
 *   rjit search-index --src <dir>    # override source directory
 *   rjit search-index --out <file>   # override output path
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

// ── TypeScript loader ─────────────────────────────────────────

function loadTypeScript() {
  try { return _require('typescript'); } catch {}
  // Walk up from cwd looking for typescript in node_modules
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'node_modules', 'typescript');
    if (existsSync(candidate)) {
      try { return _require(candidate); } catch {}
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ── File walking ──────────────────────────────────────────────

function findTsxFiles(dir) {
  const files = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'out']);
  function walk(d) {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (skip.has(entry.name)) continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

// ── Story ID inference ────────────────────────────────────────

// "SearchStory.tsx" → "search", "NavigationStory.tsx" → "navigation"
function inferStoryId(filePath) {
  const name = basename(filePath, '.tsx').replace(/\.jsx$/, '');
  // Strip common suffixes
  const stripped = name
    .replace(/Story$/, '')
    .replace(/Demo$/, '')
    .replace(/Example$/, '');
  // CamelCase → kebab-case
  return stripped
    .replace(/([A-Z])/g, (m, c, offset) => (offset > 0 ? '-' : '') + c.toLowerCase())
    .replace(/^-/, '');
}

// ── Text-bearing props ────────────────────────────────────────

const TEXT_PROPS = new Set(['placeholder', 'label', 'description', 'title', 'name', 'value', 'caption', 'hint']);
const TEXT_TAGS  = new Set(['Text']);

// ── AST helpers ───────────────────────────────────────────────

function getTagName(element, ts) {
  const tag = element.tagName;
  if (ts.isIdentifier(tag)) return tag.text;
  if (ts.isPropertyAccessExpression(tag)) return tag.name.text;
  return null;
}

function getAttrStringValue(attr, ts) {
  if (!attr.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
    if (ts.isStringLiteral(attr.initializer.expression))
      return attr.initializer.expression.text;
  }
  return null;
}

function getStaticText(node, ts) {
  if (!node) return '';
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return getStaticText(node.expression, ts);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    return getStaticText(node.left, ts) + getStaticText(node.right, ts);
  return '';
}

// Find enclosing component name by walking up the AST
function getEnclosingComponent(node, ts) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const p = current.parent;
      if (p && ts.isVariableDeclarator(p) && ts.isIdentifier(p.name)) return p.name.text;
    }
    current = current.parent;
  }
  return '';
}

// ── Index builder ─────────────────────────────────────────────

function indexFile(filePath, cwd, ts) {
  let source;
  try { source = readFileSync(filePath, 'utf-8'); } catch { return []; }

  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const relPath = relative(cwd, filePath).replace(/\\/g, '/');
  const storyId = relPath.includes('stories/') ? inferStoryId(filePath) : undefined;

  const entries = [];

  function getContext(node) {
    // Collect JSX ancestor tag names as breadcrumb
    const ctx = [];
    let p = node.parent;
    while (p) {
      if (ts.isJsxElement(p)) {
        const name = getTagName(p.openingElement, ts);
        if (name) ctx.push(name);
      } else if (ts.isJsxSelfClosingElement(p)) {
        const name = getTagName(p, ts);
        if (name) ctx.push(name);
      }
      p = p.parent;
    }
    return ctx;
  }

  function visit(node, jsxAncestors) {
    if (ts.isJsxElement(node)) {
      const tag = getTagName(node.openingElement, ts);
      const pos = ts.getLineAndCharacterOfPosition(sf, node.openingElement.getStart(sf));
      const line = pos.line + 1;
      const col  = pos.character + 1;

      if (TEXT_TAGS.has(tag)) {
        // Collect all static text children
        let text = '';
        for (const child of node.children) {
          if (ts.isJsxText(child) && child.text.trim()) {
            text += child.text.trim();
          } else if (ts.isJsxExpression(child) && child.expression) {
            const s = getStaticText(child.expression, ts);
            if (s) text += s;
          }
        }
        if (text.trim()) {
          const component = getEnclosingComponent(node, ts);
          entries.push({
            id:        `${relPath}:${line}:${col}`,
            text:      text.trim(),
            file:      relPath,
            line,
            col,
            component: component || tag,
            context:   jsxAncestors.slice(0, 4),
            ...(storyId ? { storyId } : {}),
          });
        }
      }

      // Text-bearing props on any element
      const attrs = node.openingElement.attributes;
      if (attrs) {
        for (const attr of attrs.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const propName = attr.name && attr.name.text;
          if (!TEXT_PROPS.has(propName)) continue;
          const val = getAttrStringValue(attr, ts);
          if (val && val.trim()) {
            const component = getEnclosingComponent(node, ts);
            entries.push({
              id:        `${relPath}:${line}:${col}:${propName}`,
              text:      val.trim(),
              file:      relPath,
              line,
              col,
              component: component || tag,
              context:   [propName, ...jsxAncestors].slice(0, 4),
              propKey:   propName,
              ...(storyId ? { storyId } : {}),
            });
          }
        }
      }

      // Recurse into children with updated ancestor list
      const childAncestors = tag ? [tag, ...jsxAncestors] : jsxAncestors;
      for (const child of node.children) visit(child, childAncestors);
      return;
    }

    if (ts.isJsxSelfClosingElement(node)) {
      const tag = getTagName(node, ts);
      const pos = ts.getLineAndCharacterOfPosition(sf, node.getStart(sf));
      const line = pos.line + 1;
      const col  = pos.character + 1;

      const attrs = node.attributes;
      if (attrs) {
        for (const attr of attrs.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const propName = attr.name && attr.name.text;
          if (!TEXT_PROPS.has(propName)) continue;
          const val = getAttrStringValue(attr, ts);
          if (val && val.trim()) {
            const component = getEnclosingComponent(node, ts);
            entries.push({
              id:        `${relPath}:${line}:${col}:${propName}`,
              text:      val.trim(),
              file:      relPath,
              line,
              col,
              component: component || tag,
              context:   [propName, ...jsxAncestors].slice(0, 4),
              propKey:   propName,
              ...(storyId ? { storyId } : {}),
            });
          }
        }
      }
      return;
    }

    ts.forEachChild(node, (child) => visit(child, jsxAncestors));
  }

  visit(sf, []);
  return entries;
}

// ── Public command ────────────────────────────────────────────

export async function searchIndexCommand(args) {
  const cwd = process.cwd();
  const srcIdx  = args.indexOf('--src');
  const outIdx  = args.indexOf('--out');
  const srcDir  = srcIdx  !== -1 ? args[srcIdx  + 1] : join(cwd, 'src');
  const outFile = outIdx  !== -1 ? args[outIdx  + 1] : join(cwd, 'dist', 'search-index.json');

  const ts = loadTypeScript();
  if (!ts) {
    console.error('  [search-index] TypeScript not found — run npm install first');
    process.exit(1);
  }

  if (!existsSync(srcDir)) {
    console.error(`  [search-index] Source directory not found: ${srcDir}`);
    process.exit(1);
  }

  const files = findTsxFiles(srcDir);
  if (files.length === 0) {
    console.log(`  [search-index] No .tsx files found in ${srcDir}`);
    return;
  }

  const allEntries = [];
  for (const f of files) {
    const entries = indexFile(f, cwd, ts);
    allEntries.push(...entries);
  }

  // Deduplicate by id
  const seen = new Set();
  const unique = allEntries.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const outDir = dirname(outFile);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(unique, null, 2));

  const storyCount = new Set(unique.map(e => e.storyId).filter(Boolean)).size;
  console.log(
    `  [search-index] ${unique.length} entries from ${files.length} files` +
    (storyCount ? ` (${storyCount} stories)` : '') +
    ` → ${relative(cwd, outFile)}`
  );
}
