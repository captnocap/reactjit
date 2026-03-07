/**
 * classify.mjs — Pattern extractor for the ReactJIT classifier system
 *
 * Scans TSX files, finds repeated inline style + prop patterns on JSX
 * primitives, groups them by structural hash, applies semantic naming
 * heuristics, and outputs a ready-to-use .cls.ts file.
 *
 * Usage:
 *   rjit classify                   Scan src/ and print analysis
 *   rjit classify --output app.cls.ts   Write classifier sheet to file
 *   rjit classify --min 3           Only patterns with 3+ occurrences (default: 2)
 *   rjit classify --prefix App      Prefix all names with "App" (default: auto)
 *   rjit classify --dir ./stories   Scan a specific directory instead of src/
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

// ── Primitives the classifier system supports ────────────────

const CLASSIFIER_PRIMITIVES = new Set([
  'Box', 'Row', 'Col', 'Text', 'Image', 'Pressable', 'ScrollView', 'Input', 'Video',
]);

// Also match lowercase/aliased forms in JSX
const TAG_TO_PRIMITIVE = {
  'Box': 'Box', 'View': 'Box', 'view': 'Box',
  'Row': 'Row', 'FlexRow': 'Row',
  'Col': 'Col', 'FlexColumn': 'Col',
  'Text': 'Text', 'text': 'Text',
  'Image': 'Image', 'image': 'Image',
  'Pressable': 'Pressable',
  'ScrollView': 'ScrollView',
  'TextInput': 'Input', 'Input': 'Input',
  'Video': 'Video', 'VideoPlayer': 'Video',
};

// ── Theme color detection ────────────────────────────────────
// Maps `c.X` or `colors.X` property access → 'theme:X'

const THEME_PROP_MAP = {
  'bg': 'theme:bg',
  'bgAlt': 'theme:bgAlt',
  'bgElevated': 'theme:bgElevated',
  'text': 'theme:text',
  'textSecondary': 'theme:textSecondary',
  'textDim': 'theme:textDim',
  'muted': 'theme:textDim',          // common alias
  'primary': 'theme:primary',
  'primaryHover': 'theme:primaryHover',
  'primaryPressed': 'theme:primaryPressed',
  'surface': 'theme:surface',
  'surfaceHover': 'theme:surfaceHover',
  'border': 'theme:border',
  'borderFocus': 'theme:borderFocus',
  'accent': 'theme:accent',
  'error': 'theme:error',
  'warning': 'theme:warning',
  'success': 'theme:success',
  'info': 'theme:info',
};

// Known theme variable names used in stories
const THEME_VARS = new Set(['c', 'colors', 'theme', 'themeColors']);

// ── File discovery ───────────────────────────────────────────

function findTsxFiles(dir) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...findTsxFiles(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.cls.ts')) {
      results.push(full);
    }
  }
  return results;
}

// ── AST helpers ──────────────────────────────────────────────

function getTagName(element, ts) {
  const tag = element.tagName;
  if (ts.isIdentifier(tag)) return tag.text;
  if (ts.isPropertyAccessExpression(tag)) return tag.name.text;
  return null;
}

/**
 * Extract the literal value from an AST initializer node.
 * Returns { value, kind } where kind is 'literal', 'theme', or 'dynamic'.
 */
function extractValue(node, ts) {
  if (!node) return { value: null, kind: 'dynamic' };

  // Numeric literal: 10, 0.5
  if (ts.isNumericLiteral(node)) {
    return { value: parseFloat(node.text), kind: 'literal' };
  }

  // String literal: 'bold', '#fff', '100%'
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { value: node.text, kind: 'literal' };
  }

  // true / false
  if (node.kind === ts.SyntaxKind.TrueKeyword) return { value: true, kind: 'literal' };
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { value: false, kind: 'literal' };

  // Property access: c.text, c.bgElevated, colors.muted
  if (ts.isPropertyAccessExpression(node)) {
    const obj = node.expression;
    const prop = node.name.text;
    if (ts.isIdentifier(obj) && THEME_VARS.has(obj.text) && THEME_PROP_MAP[prop]) {
      return { value: THEME_PROP_MAP[prop], kind: 'theme' };
    }
  }

  // Negative number: -10
  if (ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(node.operand)) {
    return { value: -parseFloat(node.operand.text), kind: 'literal' };
  }

  return { value: null, kind: 'dynamic' };
}

/**
 * Extract all static properties from an inline style object literal.
 * Returns { statics: Record<string,any>, dynamicKeys: string[], hasSpread: boolean }
 */
function extractStyleProps(objLit, ts) {
  const statics = {};
  const dynamicKeys = [];
  let hasSpread = false;

  for (const prop of objLit.properties) {
    if (ts.isSpreadAssignment(prop) || ts.isSpreadElement?.(prop)) {
      hasSpread = true;
      continue;
    }
    if (!ts.isPropertyAssignment(prop)) continue;

    const name = ts.isIdentifier(prop.name)
      ? prop.name.text
      : ts.isStringLiteral(prop.name)
        ? prop.name.text
        : null;
    if (!name) continue;

    const { value, kind } = extractValue(prop.initializer, ts);
    if (kind === 'literal' || kind === 'theme') {
      statics[name] = value;
    } else {
      dynamicKeys.push(name);
    }
  }

  return { statics, dynamicKeys, hasSpread };
}

/**
 * Extract classifier-relevant props from a JSX element (non-style props).
 * For Text: bold, color, size, etc.
 * For Image: src (skip dynamic), width/height from style.
 */
function extractJsxProps(element, ts) {
  const attrs = element.attributes;
  if (!attrs) return {};
  const props = {};

  for (const attr of attrs.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    if (!attr.name) continue;
    const name = attr.name.text;

    // Skip event handlers, children, key, ref, testId, style (handled separately)
    if (name.startsWith('on') || name === 'children' || name === 'key' ||
        name === 'ref' || name === 'testId' || name === 'style') continue;

    if (!attr.initializer) {
      // Boolean prop: <Text bold />
      props[name] = true;
      continue;
    }

    if (ts.isStringLiteral(attr.initializer)) {
      props[name] = attr.initializer.text;
      continue;
    }

    if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression) {
      const { value, kind } = extractValue(attr.initializer.expression, ts);
      if (kind === 'literal' || kind === 'theme') {
        props[name] = value;
      }
      // Skip dynamic props — they vary per usage
    }
  }

  return props;
}

// ── Signature hashing ────────────────────────────────────────

function makeSignature(primitive, styleStatics, jsxProps) {
  // Combine element type + sorted static style + sorted jsx props into a stable key
  const parts = [primitive];

  // Style props (prefix with 's:' to avoid collisions)
  const styleKeys = Object.keys(styleStatics).sort();
  for (const k of styleKeys) {
    parts.push(`s:${k}=${JSON.stringify(styleStatics[k])}`);
  }

  // JSX props (prefix with 'p:')
  const propKeys = Object.keys(jsxProps).sort();
  for (const k of propKeys) {
    parts.push(`p:${k}=${JSON.stringify(jsxProps[k])}`);
  }

  return parts.join('|');
}

// ── Semantic naming ──────────────────────────────────────────

/**
 * Generate a semantic name from the pattern's structural traits.
 * Returns a PascalCase name that describes what the pattern IS.
 */
function suggestName(primitive, styleStatics, jsxProps, prefix) {
  const s = styleStatics;
  const p = jsxProps;
  const pfx = prefix ? prefix : '';

  // ── Text naming (based on size + weight + color + extra style props) ──
  if (primitive === 'Text') {
    const size = s.fontSize || p.size;
    const bold = s.fontWeight === 'bold' || p.bold === true;
    const color = s.color || p.color || '';
    const hasLetterSpacing = 'letterSpacing' in s;
    const styleKeyCount = Object.keys(s).length;

    // Color modifier
    let colorMod = '';
    if (typeof color === 'string') {
      if (color.includes('textDim') || color.includes('muted')) colorMod = 'Dim';
      else if (color.includes('error') || color.includes('#f38b') || color.includes('red')) colorMod = 'Error';
      else if (color.includes('accent') || color.includes('#8b5c')) colorMod = 'Accent';
      else if (color.includes('primary')) colorMod = 'Primary';
      else if (color.includes('success') || color.includes('#a6e3') || color.includes('green')) colorMod = 'Ok';
      else if (color.includes('warning') || color.includes('#f9e2') || color.includes('#fab3')) colorMod = 'Warn';
      else if (color.includes('#89b4') || color.includes('blue') || color.includes('info')) colorMod = 'Info';
      else if (color.includes('#94e2') || color.includes('teal')) colorMod = 'Teal';
      else if (color.includes('#cba6') || color.includes('mauve')) colorMod = 'Mauve';
      else if (color.includes('text')) colorMod = '';  // default text color = no modifier
    }
    // No color at all
    const noColor = !color;

    // Extra style traits for disambiguation
    let extraMod = '';
    if (s.width || s.flexShrink === 0) extraMod += 'Fixed';
    if (s.textAlign === 'center') extraMod += 'Center';
    if (s.textAlign === 'right') extraMod += 'Right';

    // Size tier name
    let sizeName;
    if (hasLetterSpacing && bold) sizeName = 'Label';
    else if (!size) sizeName = bold ? 'BoldText' : 'Text';
    else if (size >= 20) sizeName = bold ? 'Title' : 'DisplayText';
    else if (size >= 16) sizeName = bold ? 'Heading' : 'LargeText';
    else if (size >= 14) sizeName = bold ? 'SectionHead' : 'LargeBody';
    else if (size >= 12) sizeName = bold ? 'Subtitle' : 'MedText';
    else if (size >= 11) sizeName = bold ? 'BoldBody' : 'Body11';
    else if (size >= 10) sizeName = bold ? 'BoldBody10' : 'Body';
    else if (size >= 9) sizeName = bold ? 'SmallBold' : 'Caption';
    else if (size >= 8) sizeName = bold ? 'TinyBold' : 'Tiny';
    else if (size >= 6) sizeName = 'Micro';
    else sizeName = 'Nano';

    // Compose: prefix + colorMod + sizeName + extraMod
    // e.g., DimCaption, AccentBody, ErrorTiny, Label, Title
    return `${pfx}${colorMod}${sizeName}${extraMod}`;
  }

  // ── Image naming (based on exact pixel size) ──
  if (primitive === 'Image') {
    const w = s.width || p.width;
    const h = s.height || p.height;
    if (w && h) return `${pfx}Icon${w}x${h}`;
    const size = w || h;
    if (size) return `${pfx}Icon${size}`;
    return `${pfx}Img`;
  }

  // ── Box / Row / Col naming ──
  const isRow = primitive === 'Row' || s.flexDirection === 'row';
  const hasBgElevated = typeof s.backgroundColor === 'string' && s.backgroundColor.includes('Elevated');
  const hasBgSurface = typeof s.backgroundColor === 'string' && s.backgroundColor.includes('surface');
  const hasBg = typeof s.backgroundColor === 'string' && s.backgroundColor.includes('theme:bg') && !hasBgElevated;
  const hasBorderBottom = s.borderBottomWidth > 0;
  const hasBorderTop = s.borderTopWidth > 0;
  const hasBorderLeft = s.borderLeftWidth > 0;
  const hasRadius = s.borderRadius > 0;
  const pad = s.padding || s.paddingLeft || s.paddingTop || 0;
  const hasPadding = pad > 0;
  const gap = s.gap || 0;
  const hasGap = gap > 0;
  const isFullSize = s.width === '100%' && s.height === '100%';
  const isDividerLike = (s.height === 1 || s.height === 0.5) && !hasPadding;
  const isDot = s.width && s.height && s.width === s.height && s.width <= 12 && s.borderRadius >= s.width / 2;
  const isFlexFill = (s.flexGrow === 1);
  const isHalf = (s.flexGrow === 1 && s.flexBasis === 0);
  const radius = s.borderRadius || 0;

  // Specific patterns (most specific first)
  if (isFullSize && hasBg) return `${pfx}Root`;
  if (isDot) return `${pfx}Dot${s.width}`;
  if (isDividerLike) return `${pfx}Divider`;

  if (hasBgElevated && hasBorderBottom) return `${pfx}HeaderBar`;
  if (hasBgElevated && hasBorderTop) return `${pfx}FooterBar`;
  if (hasBgElevated && hasRadius) return `${pfx}Well${radius ? `R${radius}` : ''}`;
  if (hasBgElevated && hasPadding) return `${pfx}ElevatedPanel`;

  if (hasBgSurface && hasRadius) return `${pfx}InputWell${radius ? `R${radius}` : ''}`;
  if (hasBgSurface) return `${pfx}Surface`;

  if (hasBorderLeft && hasPadding) return `${pfx}Callout`;

  if (isHalf && hasGap) return `${pfx}HalfGap${gap}`;
  if (isHalf) return `${pfx}Half`;
  if (isFlexFill && !hasPadding && !hasRadius) return `${pfx}Spacer`;

  // Radius + padding without other signals = badge/chip/card family
  if (hasRadius && hasPadding && !hasGap) {
    if (pad <= 4) return `${pfx}Tag${radius ? `R${radius}` : ''}`;
    if (pad <= 8) return `${pfx}Chip${radius ? `R${radius}` : ''}`;
    if (pad <= 12) return `${pfx}Badge${radius ? `R${radius}` : ''}`;
    return `${pfx}CardR${radius}`;
  }
  if (hasRadius && hasPadding && hasGap) return `${pfx}Card${radius ? `R${radius}` : ''}`;

  if (isRow && hasGap && hasPadding) return `${pfx}Band${gap ? `G${gap}` : ''}`;
  if (isRow && hasGap) return `${pfx}InlineG${gap}`;
  if (isRow) return `${pfx}Inline`;

  if (hasPadding && hasGap) return `${pfx}Section${gap ? `G${gap}` : ''}`;
  if (hasGap) return `${pfx}Stack${gap}`;
  if (hasPadding) return `${pfx}Pad${pad}`;

  if (hasRadius) return `${pfx}RoundR${radius}`;
  if (isFlexFill) return `${pfx}Fill`;

  // Minimal style — name by total prop count
  const totalProps = Object.keys(s).length + Object.keys(p).length;
  if (totalProps <= 1) return `${pfx}Bare`;
  return `${pfx}Box${totalProps}p`;
}

/**
 * Deduplicate names. For collisions, differentiate by the most distinctive
 * trait that differs between the colliding groups.
 */
function deduplicateNames(groups) {
  // Group by base name
  const byName = new Map();
  for (const g of groups) {
    if (!byName.has(g.suggestedName)) byName.set(g.suggestedName, []);
    byName.get(g.suggestedName).push(g);
  }

  for (const [name, items] of byName) {
    if (items.length <= 1) continue;

    // Try differentiating by traits in order of usefulness
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      const suffix = buildDistinctSuffix(g, items);
      g.suggestedName = i === 0 && !suffix ? name : `${name}${suffix || `V${i + 1}`}`;
    }

    // If first item got no suffix but others did, check if it's still unique
    const finalNames = new Set();
    for (const g of items) {
      if (finalNames.has(g.suggestedName)) {
        // Still colliding — fall back to numbering
        let n = 2;
        while (finalNames.has(`${g.suggestedName}${n}`)) n++;
        g.suggestedName = `${g.suggestedName}${n}`;
      }
      finalNames.add(g.suggestedName);
    }
  }
}

/**
 * Build a distinguishing suffix from the pattern's unique traits.
 */
function buildDistinctSuffix(group, siblings) {
  const s = group.styleStatics;
  const p = group.jsxProps;
  const parts = [];

  // Collect all trait dimensions that differ across siblings
  const traits = [
    { key: 'color', get: g => g.styleStatics.color || g.jsxProps.color || '' },
    { key: 'bold', get: g => g.styleStatics.fontWeight === 'bold' || g.jsxProps.bold === true },
    { key: 'padding', get: g => g.styleStatics.padding || g.styleStatics.paddingLeft || g.styleStatics.paddingTop || 0 },
    { key: 'gap', get: g => g.styleStatics.gap || 0 },
    { key: 'borderRadius', get: g => g.styleStatics.borderRadius || 0 },
    { key: 'width', get: g => g.styleStatics.width || '' },
    { key: 'height', get: g => g.styleStatics.height || '' },
    { key: 'flexShrink', get: g => g.styleStatics.flexShrink },
    { key: 'bg', get: g => g.styleStatics.backgroundColor || '' },
    { key: 'border', get: g => (g.styleStatics.borderWidth || 0) + (g.styleStatics.borderBottomWidth || 0) + (g.styleStatics.borderTopWidth || 0) },
    { key: 'propCount', get: g => Object.keys(g.styleStatics).length + Object.keys(g.jsxProps).length },
  ];

  const myValues = {};
  for (const t of traits) {
    myValues[t.key] = JSON.stringify(t.get(group));
  }

  // Find traits where this group differs from at least one sibling
  for (const t of traits) {
    const myVal = t.get(group);
    const differs = siblings.some(g => g !== group && JSON.stringify(t.get(g)) !== myValues[t.key]);
    if (!differs) continue;

    // Build a concise modifier from this trait
    if (t.key === 'color') {
      const c = String(myVal);
      if (!c) parts.push('Plain');
      else if (c.includes('textDim') || c.includes('muted')) { /* already in name */ }
      else if (c.includes('text')) { /* default */ }
      else if (c.includes('accent')) parts.push('Accent');
      else if (c.includes('error')) parts.push('Err');
      else if (c.includes('#')) parts.push(`C${c.slice(1, 4)}`);
      break; // one trait is usually enough
    }
    if (t.key === 'bold') { parts.push(myVal ? 'Bold' : 'Normal'); break; }
    if (t.key === 'padding') { if (myVal) parts.push(`P${myVal}`); break; }
    if (t.key === 'gap') { if (myVal) parts.push(`G${myVal}`); break; }
    if (t.key === 'width') { if (myVal) parts.push(`W${myVal}`); break; }
    if (t.key === 'height') { if (myVal) parts.push(`H${myVal}`); break; }
    if (t.key === 'propCount') { parts.push(`${myVal}s`); break; }
  }

  return parts.join('');
}

// ── Main scanner ─────────────────────────────────────────────

/**
 * Scan all TSX files under `dir`, extract patterns, group and name them.
 */
function scanPatterns(dir, ts, minOccurrences) {
  const files = findTsxFiles(dir);
  /** @type {Map<string, { primitive, styleStatics, jsxProps, dynamicKeys, occurrences }>} */
  const groups = new Map();

  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX,
    );

    walkJsx(sourceFile, sourceFile, filePath, ts, groups);
  }

  // Filter by min occurrences and sort by frequency
  const results = [];
  for (const [sig, group] of groups) {
    if (group.occurrences.length < minOccurrences) continue;
    // Skip patterns with no static props (just a bare <Box> with no style)
    const propCount = Object.keys(group.styleStatics).length + Object.keys(group.jsxProps).length;
    if (propCount === 0) continue;
    results.push(group);
  }

  results.sort((a, b) => b.occurrences.length - a.occurrences.length);
  return { groups: results, fileCount: files.length };
}

function walkJsx(node, sourceFile, filePath, ts, groups) {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const element = ts.isJsxElement(node) ? node.openingElement : node;
    const tagName = getTagName(element, ts);
    const primitive = tagName ? TAG_TO_PRIMITIVE[tagName] : null;

    if (primitive) {
      // Extract style props
      let styleStatics = {};
      let dynamicKeys = [];
      let hasSpread = false;

      const attrs = element.attributes;
      if (attrs) {
        for (const attr of attrs.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          if (!attr.name || attr.name.text !== 'style') continue;
          const init = attr.initializer;
          if (init && ts.isJsxExpression(init) && init.expression &&
              ts.isObjectLiteralExpression(init.expression)) {
            const extracted = extractStyleProps(init.expression, ts);
            styleStatics = extracted.statics;
            dynamicKeys = extracted.dynamicKeys;
            hasSpread = extracted.hasSpread;
          }
        }
      }

      // Skip elements with spread in style — not fully analyzable
      if (!hasSpread) {
        const jsxProps = extractJsxProps(element, ts);
        const sig = makeSignature(primitive, styleStatics, jsxProps);

        // Get enclosing function name for context
        let parentFn = '';
        let p = node.parent;
        while (p) {
          if (ts.isFunctionDeclaration(p) && p.name) { parentFn = p.name.text; break; }
          if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) { parentFn = p.name.text; break; }
          if (ts.isMethodDeclaration(p) && ts.isIdentifier(p.name)) { parentFn = p.name.text; break; }
          p = p.parent;
        }

        const pos = ts.getLineAndCharacterOfPosition(sourceFile, element.getStart(sourceFile));

        if (!groups.has(sig)) {
          groups.set(sig, {
            primitive,
            styleStatics,
            jsxProps,
            dynamicKeys,
            occurrences: [],
            suggestedName: '',
          });
        }
        groups.get(sig).occurrences.push({
          file: filePath,
          line: pos.line + 1,
          parentFn,
        });
      }
    }
  }

  ts.forEachChild(node, child => walkJsx(child, sourceFile, filePath, ts, groups));
}

// ── Element scanning (for pick mode) ────────────────────────

/**
 * Scan all JSX elements individually (not grouped by signature).
 * Only includes elements with fully static styles (no spread, no dynamic keys).
 */
function scanElements(dir, ts) {
  const files = findTsxFiles(dir);
  const elements = [];

  for (const filePath of files) {
    const source = readFileSync(filePath, 'utf-8');
    const sf = ts.createSourceFile(
      filePath, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX,
    );

    function visit(node) {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const element = ts.isJsxElement(node) ? node.openingElement : node;
        const tagName = getTagName(element, ts);
        const primitive = tagName ? TAG_TO_PRIMITIVE[tagName] : null;

        if (primitive) {
          let styleStatics = {};
          let dynamicKeys = [];
          let hasSpread = false;

          const attrs = element.attributes;
          if (attrs) {
            for (const attr of attrs.properties) {
              if (!ts.isJsxAttribute(attr)) continue;
              if (!attr.name || attr.name.text !== 'style') continue;
              const init = attr.initializer;
              if (init && ts.isJsxExpression(init) && init.expression &&
                  ts.isObjectLiteralExpression(init.expression)) {
                const extracted = extractStyleProps(init.expression, ts);
                styleStatics = extracted.statics;
                dynamicKeys = extracted.dynamicKeys;
                hasSpread = extracted.hasSpread;
              }
            }
          }

          // Only include fully static elements (migratable)
          if (!hasSpread && dynamicKeys.length === 0) {
            const jsxProps = extractJsxProps(element, ts);
            const propCount = Object.keys(styleStatics).length + Object.keys(jsxProps).length;
            if (propCount > 0) {
              const pos = ts.getLineAndCharacterOfPosition(sf, element.getStart(sf));
              elements.push({
                primitive,
                styleStatics,
                jsxProps,
                file: filePath,
                line: pos.line + 1,
              });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  return { elements, fileCount: files.length };
}

// ── Output generation ────────────────────────────────────────

function formatValue(v) {
  if (typeof v === 'string') return `'${v}'`;
  if (typeof v === 'boolean') return v.toString();
  if (typeof v === 'number') return v.toString();
  return JSON.stringify(v);
}

function generateClsFile(groups, prefix) {
  const lines = [
    `/**`,
    ` * Auto-generated classifier sheet`,
    ` * Generated by: rjit classify`,
    ` * Patterns: ${groups.length}`,
    ` * Total occurrences: ${groups.reduce((s, g) => s + g.occurrences.length, 0)}`,
    ` *`,
    ` * Review names, adjust as needed, then import at app entry.`,
    ` */`,
    ``,
    `import { classifier } from '@reactjit/core';`,
    ``,
    `classifier({`,
  ];

  for (const group of groups) {
    const { primitive, styleStatics, jsxProps, suggestedName, occurrences } = group;
    const fileCount = new Set(occurrences.map(o => o.file)).size;

    lines.push(`  // ${occurrences.length} occurrences across ${fileCount} files`);

    // Build the entry
    const entryParts = [`type: '${primitive}'`];

    // Add non-style jsx props
    for (const [k, v] of Object.entries(jsxProps)) {
      entryParts.push(`${k}: ${formatValue(v)}`);
    }

    // Add style object if there are style props
    const styleKeys = Object.keys(styleStatics);
    if (styleKeys.length > 0) {
      const styleParts = styleKeys.map(k => `${k}: ${formatValue(styleStatics[k])}`);
      if (styleParts.length <= 3) {
        entryParts.push(`style: { ${styleParts.join(', ')} }`);
      } else {
        entryParts.push(`style: {\n      ${styleParts.join(',\n      ')},\n    }`);
      }
    }

    // For Text with fontSize in style, suggest using `size` prop instead
    // (classifier Text entries use `size`, not `style.fontSize`)
    let entry;
    if (primitive === 'Text' && styleStatics.fontSize) {
      // Promote fontSize → size, fontWeight → bold, color → color
      const promoted = [];
      promoted.push(`type: 'Text'`);
      promoted.push(`size: ${styleStatics.fontSize}`);
      if (styleStatics.fontWeight === 'bold') promoted.push(`bold: true`);
      if (styleStatics.color) promoted.push(`color: ${formatValue(styleStatics.color)}`);

      // Remaining style props (not fontSize/fontWeight/color)
      const remaining = {};
      for (const k of styleKeys) {
        if (k !== 'fontSize' && k !== 'fontWeight' && k !== 'color') {
          remaining[k] = styleStatics[k];
        }
      }
      const remKeys = Object.keys(remaining);
      if (remKeys.length > 0) {
        const remParts = remKeys.map(k => `${k}: ${formatValue(remaining[k])}`);
        promoted.push(`style: { ${remParts.join(', ')} }`);
      }

      // Non-style props (excluding ones we promoted)
      for (const [k, v] of Object.entries(jsxProps)) {
        if (k !== 'size' && k !== 'bold' && k !== 'color') {
          promoted.push(`${k}: ${formatValue(v)}`);
        }
      }

      entry = promoted.join(', ');
    } else {
      entry = entryParts.join(', ');
    }

    lines.push(`  ${suggestedName}: { ${entry} },`);
    lines.push(``);
  }

  lines.push(`});`);
  lines.push(``);

  return lines.join('\n');
}

function generateReport(groups, fileCount) {
  const lines = [];
  const totalOccurrences = groups.reduce((s, g) => s + g.occurrences.length, 0);

  lines.push(`\n  Classifier Pattern Analysis`);
  lines.push(`  ${'─'.repeat(50)}`);
  lines.push(`  Files scanned: ${fileCount}`);
  lines.push(`  Patterns found: ${groups.length}`);
  lines.push(`  Total inline styles replaced: ${totalOccurrences}`);
  lines.push(`  ${'─'.repeat(50)}\n`);

  // Table header
  lines.push(`  ${'Name'.padEnd(25)} ${'Type'.padEnd(12)} ${'Hits'.padStart(5)} ${'Files'.padStart(6)}  Key traits`);
  lines.push(`  ${'─'.repeat(25)} ${'─'.repeat(12)} ${'─'.repeat(5)} ${'─'.repeat(6)}  ${'─'.repeat(30)}`);

  for (const group of groups) {
    const { primitive, styleStatics, jsxProps, suggestedName, occurrences } = group;
    const fileCount = new Set(occurrences.map(o => o.file)).size;

    // Build trait summary
    const traits = [];
    if (styleStatics.fontSize) traits.push(`${styleStatics.fontSize}px`);
    if (styleStatics.fontWeight === 'bold' || jsxProps.bold) traits.push('bold');
    if (styleStatics.backgroundColor) {
      const bg = styleStatics.backgroundColor;
      if (bg.includes('Elevated')) traits.push('bgElevated');
      else if (bg.includes('surface')) traits.push('surface');
      else if (bg.includes('bg')) traits.push('bg');
      else traits.push('bg:custom');
    }
    if (styleStatics.borderRadius) traits.push(`r${styleStatics.borderRadius}`);
    if (styleStatics.padding) traits.push(`p${styleStatics.padding}`);
    if (styleStatics.gap) traits.push(`gap${styleStatics.gap}`);
    if (styleStatics.borderBottomWidth) traits.push('borderBot');
    if (styleStatics.borderTopWidth) traits.push('borderTop');
    if (styleStatics.borderLeftWidth) traits.push('borderLeft');
    if (styleStatics.flexGrow) traits.push('grow');
    if (styleStatics.color) {
      const c = styleStatics.color;
      if (c.includes('textDim') || c.includes('muted')) traits.push('muted');
      else if (c.includes('text')) traits.push('text');
      else if (c.includes('accent')) traits.push('accent');
    }

    const traitStr = traits.join(', ');
    lines.push(`  ${suggestedName.padEnd(25)} ${primitive.padEnd(12)} ${String(occurrences.length).padStart(5)} ${String(fileCount).padStart(6)}  ${traitStr}`);
  }

  lines.push('');
  return lines.join('\n');
}

// ── Rename command ────────────────────────────────────────────

/**
 * Find all .cls.ts and .tsx files under a directory.
 */
function findRenameTargets(dir) {
  const results = { cls: [], tsx: [] };
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      const sub = findRenameTargets(full);
      results.cls.push(...sub.cls);
      results.tsx.push(...sub.tsx);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.cls.ts')) results.cls.push(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.cls.ts')) results.tsx.push(full);
    }
  }
  return results;
}

/**
 * Detect the local alias for `classifiers` in a file.
 * Matches: `classifiers as C`, `classifiers as cls`, `const C = classifiers`, etc.
 */
function findClassifierAliases(source) {
  const aliases = new Set();
  // import { classifiers as X }
  const importRe = /classifiers\s+as\s+(\w+)/g;
  let m;
  while ((m = importRe.exec(source))) aliases.add(m[1]);
  // const X = classifiers
  const constRe = /(?:const|let|var)\s+(\w+)\s*=\s*classifiers\b/g;
  while ((m = constRe.exec(source))) aliases.add(m[1]);
  // Direct usage without alias
  if (/\bclassifiers\s*\./.test(source)) aliases.add('classifiers');
  return aliases;
}

async function renameCommand(args) {
  if (args.length < 2) {
    console.error(`\n  Usage: rjit classify rename <OldName> <NewName>`);
    console.error(`         rjit classify rename <OldName> <NewName> --dir ./stories\n`);
    process.exit(1);
  }

  const oldName = args[0];
  const newName = args[1];
  const cwd = process.cwd();
  let scanDir = join(cwd, 'src');

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--dir') { scanDir = join(cwd, args[++i]); continue; }
  }

  if (!existsSync(scanDir)) {
    console.error(`  Directory not found: ${scanDir}`);
    process.exit(1);
  }

  if (oldName === newName) {
    console.log(`  Nothing to do — names are identical.`);
    return;
  }

  if (!/^[A-Z][A-Za-z0-9]*$/.test(newName)) {
    console.error(`  New name must be PascalCase (e.g., PageTitle, DimCaption). Got: ${newName}`);
    process.exit(1);
  }

  console.log(`\n  Renaming classifier: ${oldName} → ${newName}`);
  console.log(`  Scanning ${relative(cwd, scanDir) || '.'}/ ...\n`);

  const { cls, tsx } = findRenameTargets(scanDir);
  let totalReplacements = 0;
  const touchedFiles = [];

  // 1. Rename definition key in .cls.ts files
  for (const filePath of cls) {
    const source = readFileSync(filePath, 'utf-8');
    // Match the definition key: `  OldName: {` or `OldName:{`
    const defRe = new RegExp(`(^|[\\s,{])${oldName}(\\s*:)`, 'gm');
    if (!defRe.test(source)) continue;

    const updated = source.replace(defRe, `$1${newName}$2`);
    if (updated !== source) {
      writeFileSync(filePath, updated, 'utf-8');
      const count = (source.match(defRe) || []).length;
      totalReplacements += count;
      touchedFiles.push({ file: relative(cwd, filePath), count, type: 'def' });
    }
  }

  // 2. Rename usages in .tsx files (and .cls.ts files for cross-references)
  const allFiles = [...tsx, ...cls];
  for (const filePath of allFiles) {
    const source = readFileSync(filePath, 'utf-8');
    const aliases = findClassifierAliases(source);
    if (aliases.size === 0) continue;

    let updated = source;
    let count = 0;

    for (const alias of aliases) {
      // Match: <C.OldName, </C.OldName, C.OldName (in expressions)
      // Use word boundary after name to avoid partial matches (e.g., StoryBody vs StoryBodyText)
      const usageRe = new RegExp(`(${alias}\\.)${oldName}\\b`, 'g');
      const matches = updated.match(usageRe);
      if (matches) {
        count += matches.length;
        updated = updated.replace(usageRe, `$1${newName}`);
      }
    }

    if (updated !== source) {
      writeFileSync(filePath, updated, 'utf-8');
      totalReplacements += count;
      touchedFiles.push({ file: relative(cwd, filePath), count, type: 'usage' });
    }
  }

  // Report
  if (touchedFiles.length === 0) {
    console.log(`  No occurrences of "${oldName}" found.\n`);
    return;
  }

  console.log(`  ${'File'.padEnd(50)} ${'Type'.padEnd(6)} Hits`);
  console.log(`  ${'─'.repeat(50)} ${'─'.repeat(6)} ${'─'.repeat(4)}`);
  for (const { file, count, type } of touchedFiles) {
    console.log(`  ${file.padEnd(50)} ${type.padEnd(6)} ${count}`);
  }
  console.log(`\n  Total: ${totalReplacements} replacements across ${touchedFiles.length} files.`);
  console.log(`  ${oldName} → ${newName}\n`);
}

// ── Migrate command ───────────────────────────────────────────

/**
 * Parse a .cls.ts file and extract classifier definitions.
 * Returns Map<signatureHash, { name, primitive, props }> for matching.
 */
function parseClsFile(clsPath, ts) {
  const source = readFileSync(clsPath, 'utf-8');
  const sf = ts.createSourceFile(clsPath, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);

  // Also extract any exported const objects (like SB palette) for color resolution
  const exportedConsts = {};
  sf.forEachChild(node => {
    if (ts.isVariableStatement(node) &&
        node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
          const obj = {};
          for (const prop of decl.initializer.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              const { value } = extractValue(prop.initializer, ts);
              if (value !== null) obj[prop.name.text] = value;
            }
          }
          exportedConsts[decl.name.text] = obj;
        }
      }
    }
  });

  const classifiers = [];

  // Find classifier({...}) call
  function walk(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text === 'classifier' && node.arguments.length === 1 &&
        ts.isObjectLiteralExpression(node.arguments[0])) {
      const obj = node.arguments[0];
      for (const prop of obj.properties) {
        if (!ts.isPropertyAssignment(prop)) continue;
        const name = ts.isIdentifier(prop.name) ? prop.name.text
                   : ts.isStringLiteral(prop.name) ? prop.name.text : null;
        if (!name) continue;
        if (!ts.isObjectLiteralExpression(prop.initializer)) continue;

        // Extract classifier entry props
        const entry = {};
        for (const ep of prop.initializer.properties) {
          if (!ts.isPropertyAssignment(ep) || !ts.isIdentifier(ep.name)) continue;
          const key = ep.name.text;
          if (key === 'style' && ts.isObjectLiteralExpression(ep.initializer)) {
            entry.style = {};
            for (const sp of ep.initializer.properties) {
              if (!ts.isPropertyAssignment(sp) || !ts.isIdentifier(sp.name)) continue;
              const { value } = extractValue(sp.initializer, ts);
              // Handle SB.xxx references
              if (value === null && ts.isPropertyAccessExpression(sp.initializer)) {
                const objName = ts.isIdentifier(sp.initializer.expression) ? sp.initializer.expression.text : null;
                const propName = sp.initializer.name.text;
                if (objName && exportedConsts[objName] && exportedConsts[objName][propName] !== undefined) {
                  entry.style[sp.name.text] = exportedConsts[objName][propName];
                }
              } else if (value !== null) {
                entry.style[sp.name.text] = value;
              }
            }
          } else {
            const { value } = extractValue(ep.initializer, ts);
            if (value === null && ts.isPropertyAccessExpression(ep.initializer)) {
              const objName = ts.isIdentifier(ep.initializer.expression) ? ep.initializer.expression.text : null;
              const propName = ep.initializer.name.text;
              if (objName && exportedConsts[objName] && exportedConsts[objName][propName] !== undefined) {
                entry[key] = exportedConsts[objName][propName];
              }
            } else if (value !== null) {
              entry[key] = value;
            }
          }
        }

        const primitive = entry.type;
        if (!primitive) continue;
        delete entry.type;

        // Build signature for matching
        // For Text: size→fontSize, bold→fontWeight:'bold', color→color (in style)
        const styleStatics = { ...(entry.style || {}) };
        const jsxProps = {};
        for (const [k, v] of Object.entries(entry)) {
          if (k === 'style') continue;
          if (k === 'use') continue;
          if (primitive === 'Text') {
            if (k === 'size') { styleStatics.fontSize = v; continue; }
            if (k === 'bold' && v === true) { styleStatics.fontWeight = 'bold'; continue; }
            if (k === 'color') { styleStatics.color = v; continue; }
          }
          jsxProps[k] = v;
        }

        const sig = makeSignature(primitive, styleStatics, jsxProps);
        classifiers.push({ name, primitive, sig, styleStatics, jsxProps, entry });
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(sf);

  // Build lookup by signature
  const bySig = new Map();
  for (const c of classifiers) {
    if (!bySig.has(c.sig)) bySig.set(c.sig, c);
  }

  return { classifiers, bySig, exportedConsts };
}

/**
 * Migrate a single TSX file: replace inline styles with classifier references.
 */
function migrateFile(filePath, bySig, clsAlias, ts) {
  const source = readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);

  const replacements = []; // { start, end, text }

  function visitJsx(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const element = ts.isJsxElement(node) ? node.openingElement : node;
      const tagName = getTagName(element, ts);
      const primitive = tagName ? TAG_TO_PRIMITIVE[tagName] : null;

      if (primitive) {
        // Extract style + jsx props to compute signature
        let styleStatics = {};
        let dynamicKeys = [];
        let hasSpread = false;
        let styleAttrStart = -1, styleAttrEnd = -1;

        const attrs = element.attributes;
        if (attrs) {
          for (const attr of attrs.properties) {
            if (ts.isSpreadAssignment?.(attr) || ts.isJsxSpreadAttribute?.(attr)) {
              hasSpread = true;
              continue;
            }
            if (!ts.isJsxAttribute(attr)) continue;
            if (!attr.name || attr.name.text !== 'style') continue;
            const init = attr.initializer;
            if (init && ts.isJsxExpression(init) && init.expression &&
                ts.isObjectLiteralExpression(init.expression)) {
              const extracted = extractStyleProps(init.expression, ts);
              styleStatics = extracted.statics;
              dynamicKeys = extracted.dynamicKeys;
              hasSpread = extracted.hasSpread;
              styleAttrStart = attr.getStart(sf);
              styleAttrEnd = attr.getEnd();
            }
          }
        }

        if (hasSpread || dynamicKeys.length > 0) {
          // Can't fully migrate — has dynamic or spread props
          ts.forEachChild(node, visitJsx);
          return;
        }

        const jsxProps = extractJsxProps(element, ts);
        const sig = makeSignature(primitive, styleStatics, jsxProps);
        const match = bySig.get(sig);

        if (match) {
          // Found a classifier match! Build the replacement.
          // We need to:
          // 1. Replace <TagName with <C.ClassifierName
          // 2. Remove the style attr (it's in the classifier)
          // 3. Remove jsx props that are in the classifier
          // 4. If it's a JsxElement, also replace </TagName> with </C.ClassifierName>

          const cName = `${clsAlias}.${match.name}`;

          // Collect which props to remove (they're in the classifier)
          const removeProps = new Set(Object.keys(match.jsxProps));

          // Build new attributes string — keep props NOT in the classifier
          const keptAttrs = [];
          if (attrs) {
            for (const attr of attrs.properties) {
              if (ts.isJsxSpreadAttribute?.(attr)) {
                keptAttrs.push(source.slice(attr.getStart(sf), attr.getEnd()));
                continue;
              }
              if (!ts.isJsxAttribute(attr)) continue;
              if (!attr.name) continue;
              const aName = attr.name.text;
              if (aName === 'style') continue; // removed — it's in the classifier
              if (removeProps.has(aName)) continue; // removed — it's in the classifier
              keptAttrs.push(source.slice(attr.getStart(sf), attr.getEnd()));
            }
          }

          const attrStr = keptAttrs.length > 0 ? ' ' + keptAttrs.join(' ') : '';

          if (ts.isJsxSelfClosingElement(node)) {
            // <Tag style={{...}} /> → <C.Name />
            replacements.push({
              start: node.getStart(sf),
              end: node.getEnd(),
              text: `<${cName}${attrStr} />`,
            });
          } else {
            // <Tag style={{...}}>children</Tag> → <C.Name>children</C.Name>
            const opening = node.openingElement;
            const closing = node.closingElement;
            const childrenSrc = source.slice(opening.getEnd(), closing.getStart(sf));

            replacements.push({
              start: node.getStart(sf),
              end: node.getEnd(),
              text: `<${cName}${attrStr}>${childrenSrc}</${cName}>`,
            });
          }

          // Don't visit children of replaced nodes — they'll be carried along
          return;
        }
      }
    }
    ts.forEachChild(node, visitJsx);
  }

  visitJsx(sf);

  if (replacements.length === 0) return { changed: false, count: 0 };

  // Apply replacements from end to start
  replacements.sort((a, b) => b.start - a.start);
  let result = source;
  for (const r of replacements) {
    result = result.slice(0, r.start) + r.text + result.slice(r.end);
  }

  // Always use 'S' as the classifier alias — never conflicts with palette 'C'
  const alias = 'S';

  // Rewrite all classifier refs we just wrote from clsAlias → S
  if (clsAlias !== alias) {
    result = result.replace(new RegExp(`<${clsAlias}\\.`, 'g'), `<${alias}.`)
                   .replace(new RegExp(`</${clsAlias}\\.`, 'g'), `</${alias}.`);
  }

  // Also convert any pre-existing C.Story* refs (from before migration)
  result = result.replace(/<C\.(Story\w+)/g, `<${alias}.$1`)
                 .replace(/<\/C\.(Story\w+)/g, `</${alias}.$1`);

  // Ensure classifiers import exists
  if (!result.includes('classifiers')) {
    const importMatch = result.match(/^import .+$/gm);
    if (importMatch) {
      const lastImport = importMatch[importMatch.length - 1];
      const lastIdx = result.lastIndexOf(lastImport) + lastImport.length;
      const coreImportRe = /import\s*\{([^}]+)\}\s*from\s*'[^']*core[^']*'/;
      const coreMatch = result.match(coreImportRe);
      if (coreMatch && !coreMatch[1].includes('classifiers')) {
        const newImports = coreMatch[1].trimEnd().replace(/,\s*$/, '') + `, classifiers as ${alias}`;
        result = result.replace(coreMatch[1], newImports);
      } else if (!coreMatch) {
        result = result.slice(0, lastIdx) + `\nimport { classifiers as ${alias} } from '@reactjit/core';` + result.slice(lastIdx);
      }
    }
  } else {
    // File already imports classifiers — rewrite its alias to S
    result = result.replace(/classifiers as \w+/g, `classifiers as ${alias}`);
    result = result.replace(/const \w+ = classifiers\b/g, `const ${alias} = classifiers`);
  }

  writeFileSync(filePath, result, 'utf-8');
  return { changed: true, count: replacements.length };
}

async function migrateCommand(args, ts) {
  const cwd = process.cwd();
  let scanDir = join(cwd, 'src');
  let clsPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') { scanDir = join(cwd, args[++i]); continue; }
    if (args[i] === '--cls') { clsPath = args[++i]; continue; }
  }

  if (!existsSync(scanDir)) {
    console.error(`  Directory not found: ${scanDir}`);
    process.exit(1);
  }

  // Find .cls.ts file
  if (!clsPath) {
    const { cls } = findRenameTargets(scanDir);
    if (cls.length === 0) {
      console.error(`  No .cls.ts file found in ${scanDir}. Run rjit classify first.`);
      process.exit(1);
    }
    clsPath = cls[0];
    if (cls.length > 1) {
      console.log(`  Multiple .cls.ts files found, using: ${relative(cwd, clsPath)}`);
    }
  }

  console.log(`\n  Migrating ${relative(cwd, scanDir) || '.'}/ using ${relative(cwd, clsPath)}`);

  // Parse classifier definitions
  const { bySig } = parseClsFile(clsPath, ts);
  console.log(`  Loaded ${bySig.size} classifier signatures\n`);

  // Find all TSX files (skip .cls.ts files)
  const { tsx } = findRenameTargets(scanDir);

  // Detect what alias files use for classifiers
  let totalReplacements = 0;
  const touchedFiles = [];

  for (const filePath of tsx) {
    const source = readFileSync(filePath, 'utf-8');
    // Skip files that are already fully classified (no inline primitives with style)
    const aliases = findClassifierAliases(source);
    const clsAlias = aliases.size > 0 ? [...aliases][0] : 'C';

    const { changed, count } = migrateFile(filePath, bySig, clsAlias, ts);
    if (changed) {
      totalReplacements += count;
      touchedFiles.push({ file: relative(cwd, filePath), count });
    }
  }

  if (touchedFiles.length === 0) {
    console.log(`  No inline styles matched any classifier.\n`);
    return;
  }

  console.log(`  ${'File'.padEnd(55)} Replacements`);
  console.log(`  ${'─'.repeat(55)} ${'─'.repeat(12)}`);
  for (const { file, count } of touchedFiles.sort((a, b) => b.count - a.count)) {
    console.log(`  ${file.padEnd(55)} ${count}`);
  }
  console.log(`\n  Total: ${totalReplacements} inline styles → classifier references across ${touchedFiles.length} files.\n`);
}

// ── Pick mode helpers ─────────────────────────────────────────

/**
 * Format a compact trait summary for displaying a full style pattern.
 */
function formatTraits(styleStatics, jsxProps) {
  const parts = [];
  const s = styleStatics;
  if (s.backgroundColor) {
    const bg = String(s.backgroundColor);
    if (bg.includes('Elevated')) parts.push('bgElevated');
    else if (bg.includes('surface')) parts.push('surface');
    else if (bg.includes('bg')) parts.push('bg');
    else parts.push(`bg:${bg.slice(0, 15)}`);
  }
  if (s.borderRadius) parts.push(`r:${s.borderRadius}`);
  if (s.padding) parts.push(`p:${s.padding}`);
  else if (s.paddingLeft) parts.push(`pl:${s.paddingLeft}`);
  if (s.gap) parts.push(`gap:${s.gap}`);
  if (s.flexGrow) parts.push('grow');
  if (s.flexBasis === 0) parts.push('basis:0');
  if (s.flexShrink === 0) parts.push('shrink:0');
  if (s.width) parts.push(`w:${s.width}`);
  if (s.height != null) parts.push(`h:${s.height}`);
  if (s.borderBottomWidth) parts.push('borderBot');
  if (s.borderTopWidth) parts.push('borderTop');
  if (s.borderLeftWidth) parts.push('borderLeft');
  if (s.fontSize) parts.push(`${s.fontSize}px`);
  if (s.fontWeight === 'bold' || jsxProps.bold) parts.push('bold');
  if (s.color) {
    const c = String(s.color);
    if (c.includes('textDim') || c.includes('muted')) parts.push('muted');
    else if (c.includes('text')) parts.push('text');
    else if (c.includes('accent')) parts.push('accent');
    else parts.push(`color:${c.slice(0, 12)}`);
  }
  if (s.alignItems) parts.push(`align:${s.alignItems}`);
  if (s.justifyContent) parts.push(`justify:${s.justifyContent}`);
  const covered = new Set(['backgroundColor', 'borderRadius', 'padding', 'paddingLeft',
    'paddingRight', 'paddingTop', 'paddingBottom', 'gap', 'flexGrow', 'flexBasis',
    'flexShrink', 'width', 'height', 'borderBottomWidth', 'borderTopWidth',
    'borderLeftWidth', 'color', 'fontSize', 'fontWeight', 'borderColor',
    'alignItems', 'justifyContent']);
  for (const k of Object.keys(s)) {
    if (!covered.has(k)) parts.push(`${k}:${JSON.stringify(s[k]).slice(0, 10)}`);
  }
  for (const [k, v] of Object.entries(jsxProps)) {
    if (k !== 'bold') parts.push(`${k}:${JSON.stringify(v).slice(0, 10)}`);
  }
  return parts.join(', ');
}

/**
 * Generate a classifier entry string for a picked pattern.
 */
function generatePickEntry(p) {
  const { name, primitive, styleStatics, jsxProps, matches } = p;
  const parts = [`type: '${primitive}'`];

  if (primitive === 'Text') {
    const remaining = { ...styleStatics };
    if (remaining.fontSize != null) { parts.push(`size: ${remaining.fontSize}`); delete remaining.fontSize; }
    if (remaining.fontWeight === 'bold') { parts.push(`bold: true`); delete remaining.fontWeight; }
    if (remaining.color != null) { parts.push(`color: ${formatValue(remaining.color)}`); delete remaining.color; }
    for (const [k, v] of Object.entries(jsxProps)) {
      if (k !== 'size' && k !== 'bold' && k !== 'color') parts.push(`${k}: ${formatValue(v)}`);
    }
    const remKeys = Object.keys(remaining);
    if (remKeys.length > 0) {
      const styleParts = remKeys.map(k => `${k}: ${formatValue(remaining[k])}`);
      parts.push(`style: { ${styleParts.join(', ')} }`);
    }
  } else {
    for (const [k, v] of Object.entries(jsxProps)) {
      parts.push(`${k}: ${formatValue(v)}`);
    }
    const styleKeys = Object.keys(styleStatics);
    if (styleKeys.length > 0) {
      const styleParts = styleKeys.map(k => `${k}: ${formatValue(styleStatics[k])}`);
      if (styleParts.length <= 3) {
        parts.push(`style: { ${styleParts.join(', ')} }`);
      } else {
        parts.push(`style: {\n      ${styleParts.join(',\n      ')},\n    }`);
      }
    }
  }

  return `  // ${matches.length} occurrences\n  ${name}: { ${parts.join(', ')} },`;
}

/**
 * Append new classifier entries to an existing .cls.ts file.
 * Inserts before the final `});` that closes the classifier() call.
 */
function appendEntries(clsPath, entries) {
  const source = readFileSync(clsPath, 'utf-8');
  const lastClose = source.lastIndexOf('});');
  if (lastClose === -1) {
    console.error('  Could not find closing }); in .cls.ts file.');
    process.exit(1);
  }
  const before = source.slice(0, lastClose);
  const after = source.slice(lastClose);
  const insert = '\n' + entries.join('\n\n') + '\n';
  writeFileSync(clsPath, before + insert + after, 'utf-8');
}

// ── Pick command ──────────────────────────────────────────────

async function pickCommand(args, ts) {
  const cwd = process.cwd();
  let scanDir = join(cwd, 'src');
  let clsPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') { scanDir = join(cwd, args[++i]); continue; }
    if (args[i] === '--cls') { clsPath = args[++i]; continue; }
    if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
  rjit classify pick — Interactive pattern picker

  Usage:
    rjit classify pick                    Scan src/ interactively
    rjit classify pick --dir ./stories    Scan a specific directory
    rjit classify pick --cls my.cls.ts    Append to a specific .cls.ts file

  Flow:
    1. Pick a primitive (Box, Text, Row, ...)
    2. Pick style properties to filter by
    3. Pick a value combination
    4. See exact patterns + file locations
    5. Name each pattern
    6. Writes to .cls.ts and auto-migrates inline styles

  Type 'q' at any prompt to quit early.
`);
      return;
    }
  }

  if (!existsSync(scanDir)) {
    console.error(`  Directory not found: ${scanDir}`);
    process.exit(1);
  }

  console.log(`\n  Scanning ${relative(cwd, scanDir) || '.'}/ ...`);
  const { elements, fileCount } = scanElements(scanDir, ts);
  console.log(`  Found ${elements.length} classifiable elements across ${fileCount} files.\n`);

  if (elements.length === 0) {
    console.log('  Nothing to classify.\n');
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let stdinClosed = false;
  rl.on('close', () => { stdinClosed = true; });
  const ask = (q) => new Promise(resolve => {
    if (stdinClosed) { resolve(''); return; }
    rl.question(q, answer => resolve(answer.trim()));
    rl.once('close', () => resolve(''));
  });

  const pending = [];

  try {
    while (true) {
      // ── Step 1: Pick primitive ──────────────────────────
      const primCounts = {};
      for (const el of elements) primCounts[el.primitive] = (primCounts[el.primitive] || 0) + 1;
      const prims = Object.entries(primCounts).sort((a, b) => b[1] - a[1]);

      console.log('  Primitives:');
      for (let i = 0; i < prims.length; i++) {
        console.log(`    ${String(i + 1).padStart(3)}. ${prims[i][0].padEnd(14)} (${prims[i][1]})`);
      }

      const primInput = await ask('\n  Primitive: ');
      if (!primInput || primInput === 'q') break;
      const primIdx = parseInt(primInput, 10) - 1;
      if (isNaN(primIdx) || primIdx < 0 || primIdx >= prims.length) {
        console.log('  Invalid.\n');
        continue;
      }
      const prim = prims[primIdx][0];
      const primEls = elements.filter(el => el.primitive === prim);

      // ── Step 2: Pick filter keys ───────────────────────
      const keyCounts = {};
      for (const el of primEls) {
        for (const k of Object.keys(el.styleStatics)) keyCounts[k] = (keyCounts[k] || 0) + 1;
        for (const k of Object.keys(el.jsxProps)) keyCounts[`prop:${k}`] = (keyCounts[`prop:${k}`] || 0) + 1;
      }

      const keys = Object.entries(keyCounts).sort((a, b) => b[1] - a[1]);
      if (keys.length === 0) {
        console.log(`\n  No static properties on ${prim}.\n`);
        continue;
      }

      console.log(`\n  Properties on ${prim} (${primEls.length} elements):`);
      for (let i = 0; i < keys.length; i++) {
        const label = keys[i][0].startsWith('prop:') ? keys[i][0].slice(5) + ' (jsx)' : keys[i][0];
        console.log(`    ${String(i + 1).padStart(3)}. ${label.padEnd(28)} (${keys[i][1]})`);
      }

      const keyInput = await ask('\n  Filter by (comma-sep): ');
      if (!keyInput || keyInput === 'q') break;
      const selectedKeys = keyInput.split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(i => i >= 0 && i < keys.length)
        .map(i => keys[i][0]);
      if (selectedKeys.length === 0) {
        console.log('  Invalid.\n');
        continue;
      }

      // ── Step 3: Filter + group by value combo ──────────
      const matching = primEls.filter(el =>
        selectedKeys.every(k =>
          k.startsWith('prop:')
            ? el.jsxProps[k.slice(5)] !== undefined
            : el.styleStatics[k] !== undefined
        )
      );

      if (matching.length === 0) {
        console.log('  No elements match all selected properties.\n');
        continue;
      }

      const combos = new Map();
      for (const el of matching) {
        const key = selectedKeys
          .map(k => k.startsWith('prop:')
            ? JSON.stringify(el.jsxProps[k.slice(5)])
            : JSON.stringify(el.styleStatics[k]))
          .join('|');
        if (!combos.has(key)) combos.set(key, { values: {}, elements: [] });
        const c = combos.get(key);
        for (const k of selectedKeys) {
          const clean = k.startsWith('prop:') ? k.slice(5) : k;
          c.values[clean] = k.startsWith('prop:') ? el.jsxProps[k.slice(5)] : el.styleStatics[k];
        }
        c.elements.push(el);
      }

      const comboList = [...combos.values()].sort((a, b) => b.elements.length - a.elements.length);

      console.log(`\n  Value combinations (${comboList.length}):`);
      for (let i = 0; i < comboList.length; i++) {
        const c = comboList[i];
        const vs = Object.entries(c.values)
          .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`)
          .join(', ');
        console.log(`    ${String(i + 1).padStart(3)}. ${vs}  (${c.elements.length} matches)`);
      }

      const comboInput = await ask('\n  Value combo: ');
      if (!comboInput || comboInput === 'q') break;
      const comboIdx = parseInt(comboInput, 10) - 1;
      if (isNaN(comboIdx) || comboIdx < 0 || comboIdx >= comboList.length) {
        console.log('  Invalid.\n');
        continue;
      }
      const chosen = comboList[comboIdx];

      // ── Step 4: Sub-group by full signature ────────────
      // Migration requires exact signature match, so show full patterns.
      const subs = new Map();
      for (const el of chosen.elements) {
        const sig = makeSignature(el.primitive, el.styleStatics, el.jsxProps);
        if (!subs.has(sig)) subs.set(sig, {
          styleStatics: { ...el.styleStatics },
          jsxProps: { ...el.jsxProps },
          elements: [],
        });
        subs.get(sig).elements.push(el);
      }

      const subList = [...subs.values()].sort((a, b) => b.elements.length - a.elements.length);

      let toClassify = [];

      if (subList.length === 1) {
        // Single full pattern — proceed directly
        toClassify = [subList[0]];
      } else {
        console.log(`\n  ${subList.length} distinct full patterns within selection:`);
        for (let i = 0; i < subList.length; i++) {
          const s = subList[i];
          const traits = formatTraits(s.styleStatics, s.jsxProps);
          const fCount = new Set(s.elements.map(e => e.file)).size;
          console.log(`    ${String(i + 1).padStart(3)}. ${traits}`);
          console.log(`         ${s.elements.length} matches, ${fCount} files`);
        }

        const subInput = await ask('\n  Classify which? (comma-sep, or "all"): ');
        if (!subInput || subInput === 'q') break;

        if (subInput === 'all') {
          toClassify = subList;
        } else {
          const subIdxs = subInput.split(',').map(s => parseInt(s.trim(), 10) - 1);
          toClassify = subIdxs
            .filter(i => i >= 0 && i < subList.length)
            .map(i => subList[i]);
        }
      }

      if (toClassify.length === 0) {
        console.log('  Nothing selected.\n');
        continue;
      }

      // ── Step 5: Name each pattern ──────────────────────
      for (const sub of toClassify) {
        console.log(`\n  Pattern (${sub.elements.length} matches):`);
        console.log(`    type: '${prim}'`);
        const sEntries = Object.entries(sub.styleStatics);
        if (sEntries.length > 0) {
          console.log(`    style:`);
          for (const [k, v] of sEntries) {
            console.log(`      ${k}: ${typeof v === 'string' ? `'${v}'` : v}`);
          }
        }
        for (const [k, v] of Object.entries(sub.jsxProps)) {
          console.log(`    ${k}: ${typeof v === 'string' ? `'${v}'` : v}`);
        }

        console.log(`  Locations:`);
        for (const el of sub.elements.slice(0, 10)) {
          console.log(`    ${relative(cwd, el.file)}:${el.line}`);
        }
        if (sub.elements.length > 10) {
          console.log(`    ... and ${sub.elements.length - 10} more`);
        }

        const suggested = suggestName(prim, sub.styleStatics, sub.jsxProps, '')
          .replace(/%/g, 'Pct').replace(/[^A-Za-z0-9]/g, '');
        const nameInput = await ask(`\n  Name [${suggested}]: `);
        const name = nameInput || suggested;

        if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
          console.log('  Must be PascalCase (e.g., MyPanel). Skipped.');
          continue;
        }

        pending.push({
          name,
          primitive: prim,
          styleStatics: sub.styleStatics,
          jsxProps: sub.jsxProps,
          matches: sub.elements,
        });

        console.log(`  + ${name} (${prim}, ${sub.elements.length} matches)`);
      }

      const again = await ask('\n  Pick another? (y/N): ');
      if (again.toLowerCase() !== 'y') break;
    }

    // ── Summary + confirm ──────────────────────────────────
    if (pending.length === 0) {
      console.log('\n  Nothing to write.\n');
      return;
    }

    console.log('\n  Pending classifiers:');
    for (const p of pending) {
      console.log(`    ${p.name.padEnd(24)} ${p.primitive.padEnd(12)} ${p.matches.length} matches`);
    }

    const confirm = await ask('\n  Write to .cls.ts and migrate? (Y/n): ');
    if (confirm.toLowerCase() === 'n') {
      console.log('  Aborted.\n');
      return;
    }

    // ── Find or create .cls.ts ───────────────────────────
    if (!clsPath) {
      const { cls } = findRenameTargets(scanDir);
      clsPath = cls.length > 0 ? cls[0] : join(scanDir, 'app.cls.ts');
    }

    const entries = pending.map(p => generatePickEntry(p));

    if (existsSync(clsPath)) {
      appendEntries(clsPath, entries);
    } else {
      const content = [
        `import { classifier } from '@reactjit/core';`,
        ``,
        `classifier({`,
        ...entries,
        `});`,
        ``,
      ].join('\n');
      writeFileSync(clsPath, content, 'utf-8');
    }

    console.log(`\n  Written ${pending.length} classifiers to ${relative(cwd, clsPath)}`);

    // ── Auto-migrate ─────────────────────────────────────
    const { bySig } = parseClsFile(clsPath, ts);
    const { tsx } = findRenameTargets(scanDir);
    let totalReplacements = 0;
    const touchedFiles = [];

    for (const filePath of tsx) {
      const source = readFileSync(filePath, 'utf-8');
      const aliases = findClassifierAliases(source);
      const clsAlias = aliases.size > 0 ? [...aliases][0] : 'S';
      const { changed, count } = migrateFile(filePath, bySig, clsAlias, ts);
      if (changed) {
        totalReplacements += count;
        touchedFiles.push({ file: relative(cwd, filePath), count });
      }
    }

    if (touchedFiles.length > 0) {
      console.log(`  Migrated ${totalReplacements} inline styles across ${touchedFiles.length} files:`);
      for (const { file, count } of touchedFiles.sort((a, b) => b.count - a.count)) {
        console.log(`    ${file.padEnd(55)} ${count}`);
      }
    } else {
      console.log('  No inline styles matched for migration (may already be migrated).');
    }

    console.log('');
  } finally {
    rl.close();
  }
}

// ── Public API ───────────────────────────────────────────────

export async function classifyCommand(args) {
  // Route subcommands
  if (args[0] === 'rename') {
    return renameCommand(args.slice(1));
  }

  const cwd = process.cwd();
  const _require = createRequire(import.meta.url);
  let ts;
  try {
    ts = _require('typescript');
  } catch {
    console.error('  typescript not found — install it: npm install -D typescript');
    process.exit(1);
  }

  if (args[0] === 'migrate') {
    return migrateCommand(args.slice(1), ts);
  }

  if (args[0] === 'pick') {
    return pickCommand(args.slice(1), ts);
  }

  // Parse args
  let outputPath = join(cwd, 'app.cls.ts');
  let minOccurrences = 2;
  let prefix = '';
  let scanDir = join(cwd, 'src');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') { outputPath = args[++i]; continue; }
    if (args[i] === '--min') { minOccurrences = parseInt(args[++i], 10); continue; }
    if (args[i] === '--prefix') { prefix = args[++i]; continue; }
    if (args[i] === '--dir') { scanDir = join(cwd, args[++i]); continue; }
  }

  if (!existsSync(scanDir)) {
    console.error(`  Directory not found: ${scanDir}`);
    process.exit(1);
  }

  console.log(`\n  Scanning ${relative(cwd, scanDir) || '.'}/ for classifier patterns...`);

  const { groups, fileCount } = scanPatterns(scanDir, ts, minOccurrences);

  if (groups.length === 0) {
    console.log(`  No repeated patterns found (min: ${minOccurrences} occurrences).`);
    return;
  }

  // Apply semantic naming
  for (const group of groups) {
    group.suggestedName = suggestName(group.primitive, group.styleStatics, group.jsxProps, prefix);
  }
  deduplicateNames(groups);

  // Sanitize all names to valid JS identifiers
  for (const group of groups) {
    group.suggestedName = group.suggestedName.replace(/%/g, 'Pct').replace(/[^A-Za-z0-9]/g, '');
  }

  // Print report
  console.log(generateReport(groups, fileCount));

  // Write file
  const content = generateClsFile(groups, prefix);
  writeFileSync(outputPath, content, 'utf-8');
  console.log(`  Written to: ${outputPath}`);
  console.log(`  Import it at your app entry: import './${basename(outputPath).replace('.ts', '')}';`);

  console.log('');
}
