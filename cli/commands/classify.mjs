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

// ── Public API ───────────────────────────────────────────────

export async function classifyCommand(args) {
  const cwd = process.cwd();
  const _require = createRequire(import.meta.url);
  let ts;
  try {
    ts = _require('typescript');
  } catch {
    console.error('  typescript not found — install it: npm install -D typescript');
    process.exit(1);
  }

  // Parse args
  let outputPath = null;
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

  // Print report
  console.log(generateReport(groups, fileCount));

  // Write file if requested
  if (outputPath) {
    const content = generateClsFile(groups, prefix);
    writeFileSync(outputPath, content, 'utf-8');
    console.log(`  Written to: ${outputPath}`);
    console.log(`  Import it at your app entry: import './${basename(outputPath).replace('.ts', '')}';`);
  } else {
    console.log(`  Run with --output <file.cls.ts> to generate the classifier sheet.`);
  }

  console.log('');
}
