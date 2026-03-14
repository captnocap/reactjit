/**
 * migrate-blessed.mjs — Blessed (Node.js Terminal UI) → ReactJIT migration
 *
 * Converts Blessed terminal apps to ReactJIT TSX components. Uses the shared
 * migration-core for JSX generation, style formatting, and component assembly.
 *
 * Parser features:
 *   - UI/backend separation: only code from blessed.screen() onward is processed
 *   - Scope-aware widgets: factory functions get scoped variable names
 *   - Non-blessed event filtering: only .on() calls on known blessed widgets
 *   - Tab system detection: factory pattern → separate tab components
 *   - Table data parsing: setData() headers and rows preserved
 *   - Blessed tag stripping: {bold}, {red-fg}, etc. → clean text
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  capitalize, toPascalCase, escapeStr, indent,
  inferTypeAnnotation, stripBlessedTags,
  resolveColor, STANDARD_COLORS,
  formatStyleAttr, formatStyleObj, normalizeStyle,
  generateJSXTree, generateTableJSX,
  generateStateDecl, generateEffectDecl,
  assembleComponent,
  extractBlock, extractBrackets, extractParens,
  deriveProjectName,
} from '../lib/migration-core.mjs';
import { scaffoldProject } from './init.mjs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WIDGET MAPPING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WIDGET_MAP = {
  'screen':        { component: null,         type: 'screen' },
  'box':           { component: 'Box',        type: 'container' },
  'layout':        { component: 'Box',        type: 'container' },
  'scrollablebox': { component: 'ScrollView', type: 'scroll' },
  'form':          { component: 'Box',        type: 'container' },
  'text':          { component: 'Text',       type: 'text' },
  'bigtext':       { component: 'Text',       type: 'text', big: true },
  'line':          { component: 'Box',        type: 'divider' },
  'list':          { component: 'ScrollView', type: 'list' },
  'listtable':     { component: 'ScrollView', type: 'table' },
  'listbar':       { component: 'Box',        type: 'listbar' },
  'table':         { component: 'Box',        type: 'table' },
  'textarea':      { component: 'TextInput',  type: 'input', multiline: true },
  'textbox':       { component: 'TextInput',  type: 'input' },
  'input':         { component: 'TextInput',  type: 'input' },
  'button':        { component: 'Pressable',  type: 'button' },
  'checkbox':      { component: 'Pressable',  type: 'checkbox' },
  'radioset':      { component: 'Box',        type: 'radioset' },
  'radiobutton':   { component: 'Pressable',  type: 'radio' },
  'radio':         { component: 'Pressable',  type: 'radio' },
  'progressbar':   { component: 'Box',        type: 'progress' },
  'loading':       { component: 'Text',       type: 'text' },
  'log':           { component: 'ScrollView', type: 'log' },
  'terminal':      { component: 'Box',        type: 'terminal' },
  'filemanager':   { component: 'ScrollView', type: 'list' },
  'tree':          { component: 'ScrollView', type: 'tree' },
  'image':         { component: 'Image',      type: 'image' },
  'ansiimage':     { component: 'Image',      type: 'image' },
  'overlayimage':  { component: 'Image',      type: 'image' },
  'video':         { component: 'Box',        type: 'video' },
  'message':       { component: 'Text',       type: 'text' },
  'question':      { component: 'Box',        type: 'modal' },
  'prompt':        { component: 'Box',        type: 'modal' },
};

const CONTRIB_MAP = {
  'line':      { component: 'Box', type: 'chart', chartType: 'line' },
  'bar':       { component: 'Box', type: 'chart', chartType: 'bar' },
  'stackedBar':{ component: 'Box', type: 'chart', chartType: 'stacked-bar' },
  'gauge':     { component: 'Box', type: 'gauge' },
  'gaugeList': { component: 'Box', type: 'gauge' },
  'donut':     { component: 'Box', type: 'chart', chartType: 'donut' },
  'sparkline': { component: 'Text', type: 'sparkline' },
  'lcd':       { component: 'Text', type: 'text', big: true },
  'map':       { component: 'Box', type: 'chart', chartType: 'map' },
  'picture':   { component: 'Image', type: 'image' },
  'table':     { component: 'ScrollView', type: 'table' },
  'tree':      { component: 'ScrollView', type: 'tree' },
  'log':       { component: 'ScrollView', type: 'log' },
  'markdown':  { component: 'Text', type: 'text' },
  'canvas':    { component: 'Box', type: 'canvas' },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// OBJECT/STYLE PARSING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseObjectLiteral(src) {
  const obj = {};
  const inner = src.slice(1, -1).trim();
  if (!inner) return obj;

  // Simple key: value extraction (handles nested objects as _style)
  const lines = inner.split('\n');
  for (const line of lines) {
    const trimmed = line.trim().replace(/,\s*$/, '');
    const kvMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const val = kvMatch[2].trim().replace(/,\s*$/, '');
      obj[key] = val;
    }
  }

  // Parse style block as nested sections
  const styleIdx = inner.indexOf('style:');
  if (styleIdx !== -1) {
    const braceIdx = inner.indexOf('{', styleIdx);
    if (braceIdx !== -1) {
      const block = extractBlock(inner, braceIdx);
      if (block) {
        obj._style = parseStyleBlock(block);
      }
    }
  }

  // Parse items array
  const itemsIdx = inner.indexOf('items:');
  if (itemsIdx !== -1) {
    const bracketIdx = inner.indexOf('[', itemsIdx);
    if (bracketIdx !== -1) {
      const bracket = extractBrackets(inner, bracketIdx);
      if (bracket) {
        try {
          obj._items = JSON.parse(bracket.replace(/'/g, '"'));
        } catch { obj._items = []; }
      }
    }
  }

  return obj;
}

function parseStyleBlock(src) {
  const result = { base: {} };
  let inner = src.slice(1, -1).trim();
  if (!inner) return result;

  // Phase 1: Extract nested section blocks (e.g., border: { fg: '#565f89' })
  // This handles both single-line and multi-line nested sections.
  const sectionRegex = /(\w+)\s*:\s*\{/g;
  const sections = [];
  let sMatch;
  while ((sMatch = sectionRegex.exec(inner)) !== null) {
    const braceStart = inner.indexOf('{', sMatch.index + sMatch[1].length);
    if (braceStart === -1) continue;
    const block = extractBlock(inner, braceStart);
    if (!block) continue;

    const name = sMatch[1];
    if (!result[name]) result[name] = {};
    // Parse nested kv pairs
    const sectionContent = block.slice(1, -1).trim();
    const kvRegex = /(\w+)\s*:\s*('[^']*'|"[^"]*"|[^,}\s]+)/g;
    let kv;
    while ((kv = kvRegex.exec(sectionContent)) !== null) {
      result[name][kv[1]] = kv[2].trim();
    }
    sections.push({ start: sMatch.index, end: braceStart + block.length });
  }

  // Phase 2: Strip nested sections for base-level parsing (from end to start)
  let flat = inner;
  for (let i = sections.length - 1; i >= 0; i--) {
    flat = flat.slice(0, sections[i].start) + flat.slice(sections[i].end);
  }

  // Phase 3: Parse remaining flat kv pairs as base properties
  const kvRegex = /(\w+)\s*:\s*('[^']*'|"[^"]*"|[^,}\s]+)/g;
  let kv;
  while ((kv = kvRegex.exec(flat)) !== null) {
    result.base[kv[1]] = kv[2].trim();
  }

  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARSER (scope-aware, UI/backend separation)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function parseBlessedSource(source) {
  const result = {
    screen: null,
    widgets: [],         // { varName, scopedName, type, options, parentVar, events, line, scope }
    functions: [],       // UI-related functions only
    events: [],
    keybindings: [],
    mutations: [],
    intervals: [],
    imports: [],
    contribGrid: null,
    tabFactories: [],    // { name, title, containerVar, widgets, renderBody }
    warnings: [],
    businessLogicFunctions: [],  // non-UI functions (for reference)
  };

  let blessedAlias = 'blessed';
  let contribAlias = null;

  // ── Pass 1: Find requires and aliases ──
  const lines = source.split('\n');
  for (const line of lines) {
    const reqMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]blessed['"]\s*\)/);
    if (reqMatch) { blessedAlias = reqMatch[1]; result.imports.push('blessed'); }
    const contribMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]blessed-contrib['"]\s*\)/);
    if (contribMatch) { contribAlias = contribMatch[1]; result.imports.push('blessed-contrib'); }
  }

  // ── Pass 2: Find screen creation and UI boundary ──
  const screenRegex = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*${blessedAlias}\\.screen\\s*\\(`);
  const screenMatch = source.match(screenRegex);
  let uiBoundary = 0; // line index where blessed UI starts

  if (screenMatch) {
    const optsStart = source.indexOf('(', screenMatch.index + screenMatch[0].length - 1);
    const fullParens = extractParens(source, optsStart);
    let opts = {};
    if (fullParens) {
      const braceIdx = fullParens.indexOf('{');
      if (braceIdx !== -1) {
        const block = extractBlock(fullParens, braceIdx);
        if (block) opts = parseObjectLiteral(block);
      }
    }
    result.screen = { varName: screenMatch[1], options: opts };
    uiBoundary = source.slice(0, screenMatch.index).split('\n').length - 1;
  }

  const uiSource = source; // We'll use line numbers to filter
  const widgetVarNames = new Set();
  if (result.screen) widgetVarNames.add(result.screen.varName);

  // ── Pass 3: Find function scopes (for scope-aware widget naming) ──
  // Detect factory functions: const buildXxxTab = () => { ... } or function buildXxx() { ... }
  const scopes = []; // { name, startLine, endLine, startIdx, endIdx }
  // Handles: const x = () => {, const x = async () => {, function x() {, const x = (...) => \n new Promise(...)
  const funcScopeRegex = /(?:const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function\s*\([^)]*\))\s*[\{\n]|function\s+(\w+)\s*\([^)]*\)\s*\{)/g;
  let fsMatch;
  while ((fsMatch = funcScopeRegex.exec(source)) !== null) {
    const name = fsMatch[1] || fsMatch[2];
    const lineNum = source.slice(0, fsMatch.index).split('\n').length;
    if (lineNum < uiBoundary) continue; // skip backend functions

    // Find the first { after the match (may be on same line or in a nested callback)
    const searchStart = fsMatch.index + fsMatch[0].length - 1;
    let braceStart = -1;
    for (let bi = searchStart; bi < Math.min(source.length, searchStart + 200); bi++) {
      if (source[bi] === '{') { braceStart = bi; break; }
    }
    if (braceStart === -1) continue;

    const block = extractBlock(source, braceStart);
    if (!block) continue;

    // For arrow functions wrapping Promises, the outer scope extends to the end of the
    // Promise callback. Find the outermost balanced group from the function start.
    let endIdx = braceStart + block.length;
    // Check if there's a closing paren+semicolon after the block (Promise wrapper pattern)
    const afterBlock = source.slice(endIdx, endIdx + 20).trim();
    if (afterBlock.startsWith(')') || afterBlock.startsWith('})')) {
      // Extend to include the Promise wrapper — scan for the matching close
      const wrapperClose = source.indexOf(';', endIdx);
      if (wrapperClose !== -1 && wrapperClose - endIdx < 30) {
        endIdx = wrapperClose + 1;
      }
    }

    const endLine = source.slice(0, endIdx).split('\n').length;
    scopes.push({ name, startLine: lineNum, endLine, startIdx: fsMatch.index, endIdx });
  }
  result.scopes = scopes;

  // ── Pass 4: Find all widget declarations (scope-aware) ──
  const widgetRegex = new RegExp(
    `(?:const|let|var)\\s+(\\w+)\\s*=\\s*${blessedAlias}\\.(\\w+)\\s*\\(`,
    'g'
  );
  let wMatch;
  while ((wMatch = widgetRegex.exec(source)) !== null) {
    const varName = wMatch[1];
    const widgetType = wMatch[2];
    if (widgetType === 'screen') continue;

    const lineNum = source.slice(0, wMatch.index).split('\n').length;

    // Skip widgets defined before UI boundary
    if (lineNum < uiBoundary) continue;

    // Determine which scope this widget is in
    let scope = null;
    for (const s of scopes) {
      if (lineNum >= s.startLine && lineNum <= s.endLine) {
        scope = s.name;
        break;
      }
    }

    // Scope-prefix the varName to avoid collisions
    const scopedName = scope ? `${scope}_${varName}` : varName;

    const optsStart = source.indexOf('(', wMatch.index + wMatch[0].length - 1);
    const fullParens = extractParens(source, optsStart);
    let opts = {};
    let parentVar = null;
    if (fullParens) {
      const braceIdx = fullParens.indexOf('{');
      if (braceIdx !== -1) {
        const block = extractBlock(fullParens, braceIdx);
        if (block) {
          opts = parseObjectLiteral(block);
          const parentMatch = block.match(/parent\s*:\s*(\w+)/);
          if (parentMatch) {
            parentVar = parentMatch[1];
            // Scope the parent reference too — find which scope it was declared in
            if (scope) {
              // Check if parent was declared in same scope
              const parentInScope = result.widgets.find(w => w.varName === parentVar && w.scope === scope);
              if (parentInScope) {
                parentVar = parentInScope.scopedName;
              } else {
                // Parent might be from outer scope — check non-scoped widgets
                const parentOuter = result.widgets.find(w => w.varName === parentVar && !w.scope);
                if (parentOuter) {
                  parentVar = parentOuter.scopedName;
                }
              }
            }
          }
        }
      }
    }

    widgetVarNames.add(varName);

    result.widgets.push({
      varName,
      scopedName,
      type: widgetType,
      options: opts,
      parentVar: parentVar || null,
      events: [],
      line: lineNum,
      scope,
    });
  }

  // ── Pass 4b: blessed-contrib grid.set() calls ──
  if (contribAlias) {
    const gridRegex = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*new\\s+${contribAlias}\\.grid\\s*\\(`, 'g');
    if (source.match(gridRegex)) {
      result.contribGrid = { alias: contribAlias };
    }

    const setRegex = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(\\w+)\\.set\\s*\\((\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*${contribAlias}\\.(\\w+)`, 'g');
    let sMatch;
    while ((sMatch = setRegex.exec(source)) !== null) {
      const lineNum = source.slice(0, sMatch.index).split('\n').length;
      if (lineNum < uiBoundary) continue;
      const afterType = source.indexOf(',', sMatch.index + sMatch[0].length);
      let opts = {};
      if (afterType !== -1) {
        const braceIdx = source.indexOf('{', afterType);
        if (braceIdx !== -1 && braceIdx < afterType + 50) {
          const block = extractBlock(source, braceIdx);
          if (block) opts = parseObjectLiteral(block);
        }
      }

      result.widgets.push({
        varName: sMatch[1],
        scopedName: sMatch[1],
        type: sMatch[7],
        options: opts,
        parentVar: '__grid',
        gridPos: { row: +sMatch[3], col: +sMatch[4], rowSpan: +sMatch[5], colSpan: +sMatch[6] },
        events: [],
        line: lineNum,
        scope: null,
        isContrib: true,
      });
      widgetVarNames.add(sMatch[1]);
    }
  }

  // ── Pass 5: Find event bindings (only on blessed widgets) ──
  const eventRegex = /(\w+)\.on\s*\(\s*['"](\w+)['"]\s*,\s*/g;
  let eMatch;
  while ((eMatch = eventRegex.exec(source)) !== null) {
    const target = eMatch[1];
    const eventName = eMatch[2];

    // Only capture events on known blessed widgets
    if (!widgetVarNames.has(target)) continue;

    const lineNum = source.slice(0, eMatch.index).split('\n').length;
    if (lineNum < uiBoundary) continue;

    const afterComma = eMatch.index + eMatch[0].length;
    let handler = '';
    if (source[afterComma] === 'f' && source.slice(afterComma, afterComma + 8) === 'function') {
      const braceStart = source.indexOf('{', afterComma);
      if (braceStart !== -1) {
        const block = extractBlock(source, braceStart);
        if (block) handler = block.slice(1, -1).trim();
      }
    } else if (source.slice(afterComma, afterComma + 2) === '()' || source[afterComma] === '(') {
      // Arrow function: () => { ... } or (args) => { ... }
      const arrowIdx = source.indexOf('=>', afterComma);
      if (arrowIdx !== -1 && arrowIdx - afterComma < 30) {
        const braceStart = source.indexOf('{', arrowIdx);
        if (braceStart !== -1 && braceStart - arrowIdx < 5) {
          const block = extractBlock(source, braceStart);
          if (block) handler = block.slice(1, -1).trim();
        }
      }
    } else {
      const endParen = source.indexOf(')', afterComma);
      if (endParen !== -1 && endParen - afterComma < 60) {
        handler = source.slice(afterComma, endParen).trim();
      }
    }

    const event = { target, event: eventName, handler };
    const widget = result.widgets.find(w => w.varName === target);
    if (widget) {
      widget.events.push(event);
    } else {
      result.events.push(event);
    }
  }

  // ── Pass 6: Find .key() bindings ──
  const keyRegex = /(\w+)\.key\s*\(\s*/g;
  let kMatch;
  while ((kMatch = keyRegex.exec(source)) !== null) {
    const target = kMatch[1];
    const lineNum = source.slice(0, kMatch.index).split('\n').length;
    if (lineNum < uiBoundary) continue;

    let pos = kMatch.index + kMatch[0].length;
    let keys = [];
    if (source[pos] === '[') {
      const bracket = extractBrackets(source, pos);
      if (bracket) {
        keys = bracket.slice(1, -1).split(',').map(k => k.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
        pos += bracket.length;
      }
    } else if (source[pos] === "'" || source[pos] === '"') {
      const quote = source[pos];
      const endQuote = source.indexOf(quote, pos + 1);
      if (endQuote !== -1) {
        keys = [source.slice(pos + 1, endQuote)];
        pos = endQuote + 1;
      }
    }

    while (pos < source.length && (source[pos] === ',' || /\s/.test(source[pos]))) pos++;

    let handler = '';
    if (pos < source.length) {
      // Find the handler function body
      const braceSearch = source.indexOf('{', pos);
      if (braceSearch !== -1 && braceSearch - pos < 60) {
        const block = extractBlock(source, braceSearch);
        if (block) handler = block.slice(1, -1).trim();
      }
    }

    result.keybindings.push({ target, keys, handler });
  }

  // ── Pass 7: Find mutations (.setContent, .setData, etc.) ──
  const mutationRegex = /(\w+)\.(setContent|setItems|setProgress|setValue|setData|setLabel|clearValue|toggle|log|add|addItem|pushLine|insertLine|deleteLine|focus|show|hide)\s*\(/g;
  let mMatch;
  while ((mMatch = mutationRegex.exec(source)) !== null) {
    if (mMatch[1] === blessedAlias || mMatch[1] === contribAlias) continue;

    const lineNum = source.slice(0, mMatch.index).split('\n').length;
    if (lineNum < uiBoundary) continue;
    if (!widgetVarNames.has(mMatch[1])) continue; // only track blessed widget mutations

    // For setData, try to capture the argument
    let dataArg = null;
    if (mMatch[2] === 'setData') {
      const parenStart = mMatch.index + mMatch[0].length - 1;
      const parens = extractParens(source, parenStart);
      if (parens) {
        dataArg = parens.slice(1, -1).trim();
      }
    }

    result.mutations.push({
      target: mMatch[1],
      method: mMatch[2],
      dataArg,
      line: lineNum,
    });
  }

  // ── Pass 8: Find function declarations (only UI-related) ──
  const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let fMatch;
  while ((fMatch = funcRegex.exec(source)) !== null) {
    const lineNum = source.slice(0, fMatch.index).split('\n').length;
    const braceStart = fMatch.index + fMatch[0].length - 1;
    const block = extractBlock(source, braceStart);
    if (!block) continue;

    const name = fMatch[1];
    const body = block.slice(1, -1).trim();

    if (lineNum < uiBoundary) {
      result.businessLogicFunctions.push({ name, args: fMatch[2], body });
      continue;
    }

    // Check if function references blessed widgets
    const refsWidgets = [...widgetVarNames].some(v => body.includes(v));
    if (refsWidgets) {
      result.functions.push({ name, args: fMatch[2], body });
    } else {
      result.businessLogicFunctions.push({ name, args: fMatch[2], body });
    }
  }

  // ── Pass 9: Find variables (only UI-related, after screen) ──
  const varRegex = /(?:let|var)\s+(\w+)\s*=\s*(.+?)(?:;|$)/gm;
  let vMatch;
  while ((vMatch = varRegex.exec(source)) !== null) {
    const lineNum = source.slice(0, vMatch.index).split('\n').length;
    if (lineNum < uiBoundary) continue;
    if (vMatch[2].includes(blessedAlias + '.') || vMatch[2].includes('require(')) continue;
    // Skip loop variables and complex expressions from backend
    if (vMatch[1] === 'i' || vMatch[1] === 'j') continue;

    // Skip variables declared inside function scopes (render closures, wizard flows, etc.)
    const inScope = scopes.some(s => lineNum >= s.startLine && lineNum <= s.endLine);
    if (inScope) continue;

    // Skip blessed-internal render debouncing variables
    const name = vMatch[1];
    if (/render|timeout|timer/i.test(name) && /false|null|setTimeout|clearTimeout/.test(vMatch[2])) continue;

    result.variables = result.variables || [];
    result.variables.push({ name, value: vMatch[2].trim() });
  }
  if (!result.variables) result.variables = [];

  // ── Pass 10: Find setInterval ──
  const intervalRegex = /setInterval\s*\(\s*(\w+)\s*,\s*(\d+)\s*\)/g;
  let iMatch;
  while ((iMatch = intervalRegex.exec(source)) !== null) {
    const lineNum = source.slice(0, iMatch.index).split('\n').length;
    if (lineNum < uiBoundary) continue;
    result.intervals.push({ fn: iMatch[1], ms: parseInt(iMatch[2]) });
  }

  // ── Pass 11: Detect tab factory pattern ──
  // Functions that: (a) create a blessed.box with parent: contentArea, (b) return { container, render() }
  for (const scope of scopes) {
    const scopeBody = source.slice(scope.startIdx, scope.endIdx);
    const hasContainer = scopeBody.match(/const\s+container\s*=\s*\w+\.\w+\s*\(/);
    const hasRenderReturn = scopeBody.match(/return\s*\{[\s\S]*?container[\s\S]*?render/);
    if (hasContainer && hasRenderReturn) {
      // Extract title from return object
      const titleMatch = scopeBody.match(/title\s*:\s*['"]([^'"]+)['"]/);
      const title = titleMatch ? titleMatch[1] : scope.name.replace(/^build/, '').replace(/Tab$/, '');

      // Collect widgets in this scope
      const scopeWidgets = result.widgets.filter(w => w.scope === scope.name);

      // Extract render body
      const renderMatch = scopeBody.match(/render\s*\(\)\s*\{/);
      let renderBody = '';
      if (renderMatch) {
        const renderBraceIdx = scope.startIdx + scopeBody.indexOf(renderMatch[0]) + renderMatch[0].length - 1;
        const renderBlock = extractBlock(source, renderBraceIdx);
        if (renderBlock) renderBody = renderBlock.slice(1, -1).trim();
      }

      result.tabFactories.push({
        name: scope.name,
        title,
        containerVar: `${scope.name}_container`,
        widgets: scopeWidgets,
        renderBody,
      });
    }
  }

  result._source = source; // keep raw source for variable tracing

  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLE CONVERSION (blessed-specific)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function convertStyleSection(section) {
  const style = {};
  if (section.fg) {
    const c = resolveColor(section.fg);
    if (c) style.color = c;
  }
  if (section.bg) {
    const c = resolveColor(section.bg);
    if (c) style.backgroundColor = c;
  }
  if (section.bold === 'true' || section.bold === true) style.fontWeight = 'bold';
  if (section.underline === 'true' || section.underline === true) style.textDecorationLine = 'underline';
  return style;
}

function convertWidgetStyles(widget) {
  const opts = widget.options;
  const style = {};
  const hoverStyle = {};

  if (opts.width) {
    const w = String(opts.width).replace(/^['"]|['"]$/g, '');
    if (/^\d+$/.test(w)) style.width = parseInt(w);
    else if (w.includes('%')) {
      const pctMatch = w.match(/^(\d+)%/);
      if (pctMatch) style.width = `${pctMatch[1]}%`;
    } else if (w === 'shrink') { /* auto-size, omit */ }
  }
  if (opts.height) {
    const h = String(opts.height).replace(/^['"]|['"]$/g, '');
    if (/^\d+$/.test(h)) style.height = parseInt(h);
    else if (h.includes('%')) {
      const pctMatch = h.match(/^(\d+)%/);
      if (pctMatch) style.height = `${pctMatch[1]}%`;
    }
  }

  if (opts.padding) {
    const p = String(opts.padding).replace(/^['"]|['"]$/g, '');
    if (/^\d+$/.test(p)) style.padding = parseInt(p);
  }

  const border = opts.border?.replace?.(/^['"]|['"]$/g, '') || '';
  if (border === 'line' || border === 'bg') {
    style.borderWidth = 1;
    style.borderColor = '#555';
  }

  const align = opts.align?.replace?.(/^['"]|['"]$/g, '') || '';
  if (align === 'center') style.textAlign = 'center';
  else if (align === 'right') style.textAlign = 'right';

  const valign = opts.valign?.replace?.(/^['"]|['"]$/g, '') || '';
  if (valign === 'middle') style.justifyContent = 'center';
  else if (valign === 'bottom') style.justifyContent = 'end';

  if (opts._style) {
    const s = opts._style;
    Object.assign(style, convertStyleSection(s.base || {}));

    if (s.border?.fg) {
      const c = resolveColor(s.border.fg);
      if (c) style.borderColor = c;
    }

    const focusStyles = convertStyleSection(s.focus || {});
    const hoverStyles = convertStyleSection(s.hover || {});
    Object.assign(hoverStyle, focusStyles, hoverStyles);
  }

  // Fallback: handle top-level fg/bg (blessed allows these outside style:{})
  if (opts.fg && !style.color) {
    const c = resolveColor(opts.fg);
    if (c) style.color = c;
  }
  if (opts.bg && !style.backgroundColor) {
    const c = resolveColor(opts.bg);
    if (c) style.backgroundColor = c;
  }

  return { style: normalizeStyle(style), hoverStyle: normalizeStyle(hoverStyle) };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IR BUILDER (parsed → common IR)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function buildIR(parsed) {
  const title = parsed.screen?.options?.title?.replace(/^['"]|['"]$/g, '') || 'BlessedApp';
  const compName = toPascalCase(title);

  const ir = {
    componentName: compName,
    source: { framework: 'blessed', title },
    state: [],
    effects: [],
    functions: [],
    tree: [],
    keybindings: [],
    warnings: [...parsed.warnings],
    extraComponents: [],
  };

  // ── Determine which widgets have state ──
  const stateWidgetMethods = {};
  for (const m of parsed.mutations) {
    if (!stateWidgetMethods[m.target]) stateWidgetMethods[m.target] = new Set();
    stateWidgetMethods[m.target].add(m.method);
  }

  // ── State from variables ──
  for (const v of (parsed.variables || [])) {
    ir.state.push({
      name: v.name,
      setter: `set${capitalize(v.name)}`,
      defaultValue: v.value,
    });
  }

  // ── State from widget mutations ──
  for (const widget of parsed.widgets) {
    const methods = stateWidgetMethods[widget.varName];
    if (!methods) continue;

    if (methods.has('setContent') || methods.has('log') || methods.has('pushLine') || methods.has('add')) {
      const content = widget.options.content?.replace(/^['"`]|['"`]$/g, '') || '';
      ir.state.push({
        name: `${widget.varName}Content`,
        setter: `set${capitalize(widget.varName)}Content`,
        type: 'string',
        defaultValue: `'${escapeStr(stripBlessedTags(content))}'`,
      });
    }
    if (methods.has('setItems') || methods.has('addItem')) {
      const items = widget.options._items || [];
      ir.state.push({
        name: `${widget.varName}Items`,
        setter: `set${capitalize(widget.varName)}Items`,
        type: 'string[]',
        defaultValue: JSON.stringify(items),
      });
    }
    if (methods.has('setData')) {
      // Parse initial table data from the first setData mutation
      const dataMutation = parsed.mutations.find(m => m.target === widget.varName && m.method === 'setData' && m.dataArg);
      if (dataMutation) {
        ir.state.push({
          name: `${widget.varName}Data`,
          setter: `set${capitalize(widget.varName)}Data`,
          defaultValue: `[]`,
        });
      }
    }
    if (methods.has('setProgress')) {
      // Progress state is likely managed by a variable — add comment
      ir.state.push({ name: `_progressHint_${widget.varName}`, setter: '', type: '', defaultValue: `// Progress for ${widget.varName} — see state variable above` });
    }
  }

  // Remove hint entries
  ir.state = ir.state.filter(s => !s.name.startsWith('_progressHint_'));

  // ── Functions (convert to arrow functions with mutation conversion) ──
  for (const fn of parsed.functions) {
    const body = convertFunctionBody(fn.body, parsed);
    ir.functions.push({ name: fn.name, args: fn.args, body });
  }

  // ── Effects from intervals ──
  for (const interval of parsed.intervals) {
    ir.effects.push({
      setup: `const timer = setInterval(${interval.fn}, ${interval.ms});`,
      cleanup: `clearInterval(timer)`,
      deps: '',
    });
  }

  // ── Keybindings → onKeyDown handler ──
  const keyActions = [];
  for (const kb of parsed.keybindings) {
    const isExit = kb.handler.includes('process.exit') || kb.handler.includes('exit(') || kb.handler.includes('.destroy()');
    if (isExit) {
      ir.keybindings.push({ keys: kb.keys, comment: 'exit (no equivalent in ReactJIT)' });
      continue;
    }

    for (const key of kb.keys) {
      const handler = convertHandler(kb.handler, parsed);
      if (!handler.trim()) continue;
      // Map blessed key names to DOM-style key names
      const jsKey = mapBlessedKey(key);
      if (jsKey) {
        keyActions.push({ jsKey, handler: handler.trim() });
      }
    }
  }

  // Build onKeyDown handler string if there are actionable keybindings
  let rootKeyHandler = null;
  if (keyActions.length > 0) {
    const cases = keyActions.map(({ jsKey, handler }) =>
      `      case '${jsKey}': ${handler.length < 60 ? handler + '; break;' : '{\n        ' + handler + '\n        break;\n      }'}`
    ).join('\n');
    rootKeyHandler = `(e) => {\n    switch (e.key) {\n${cases}\n    }\n  }`;
  }
  ir._rootKeyHandler = rootKeyHandler;

  // ── Build widget tree → WidgetNode tree ──
  if (parsed.tabFactories.length > 0) {
    // Tab system detected — generate tab components
    ir.tree = buildTabSystemTree(parsed, ir, stateWidgetMethods);
  } else {
    // Normal flat tree
    const screenVar = parsed.screen?.varName || 'screen';
    const rawTree = buildWidgetTree(parsed.widgets, screenVar);
    ir.tree = [buildRootNode(rawTree, parsed, stateWidgetMethods)];
  }

  // Attach onKeyDown to root node
  if (ir._rootKeyHandler && ir.tree.length > 0) {
    if (!ir.tree[0].events) ir.tree[0].events = {};
    ir.tree[0].events.onKeyDown = ir._rootKeyHandler;
  }

  return ir;
}

/**
 * Build a tab-based UI tree.
 * Generates a root Box with tab bar + content area that switches between tab panels.
 */
function buildTabSystemTree(parsed, ir, stateWidgetMethods) {
  const screenVar = parsed.screen?.varName || 'screen';
  const bgColor = resolveColor(parsed.screen?.options?._style?.base?.bg) || '#000';

  // Add tab state
  ir.state.unshift({
    name: 'activeTab',
    setter: 'setActiveTab',
    type: 'number',
    defaultValue: '0',
  });

  const tabNames = parsed.tabFactories.map(t => t.title);

  // Build tab bar node
  const tabBarNode = {
    component: 'Box',
    style: { width: '100%', height: 1, backgroundColor: '#0000FF', flexDirection: 'row' },
    children: tabNames.map((title, idx) => ({
      component: 'Pressable',
      events: { onClick: `() => setActiveTab(${idx})` },
      style: { paddingLeft: 8, paddingRight: 8 },
      children: [{
        component: 'Text',
        textContent: `{activeTab === ${idx} ? '[ ${title} ]' : ' ${title} '}`,
        style: { fontWeight: 'bold', color: '#FFFFFF' },
      }],
    })),
  };

  // Build each tab's content as a conditional node
  const tabPanels = parsed.tabFactories.map((tab, idx) => {
    // Filter out the container widget itself — the tab panel Box is the container
    const tabWidgets = parsed.widgets.filter(w => w.scope === tab.name && w.scopedName !== tab.containerVar);
    const tabTree = buildWidgetTree(tabWidgets, tab.containerVar);
    const children = convertWidgetTreeToNodes(tabTree, parsed, stateWidgetMethods);

    return {
      component: 'Box',
      isConditional: { condition: `activeTab === ${idx}` },
      style: { width: '100%', flexGrow: 1, flexDirection: 'column' },
      children,
    };
  });

  // Build non-tab widgets (footer, etc.)
  const tabFactoryNames = new Set(parsed.tabFactories.map(t => t.name));
  const allScopes = parsed.scopes || [];

  const nonTabWidgets = parsed.widgets.filter(w => {
    if (w.scope) return false; // in a detected scope
    if (w.parentVar !== screenVar) return false;
    if (parsed.tabFactories.some(t => t.containerVar.includes(w.varName))) return false;
    // Also filter widgets whose line falls inside ANY function scope (catches arrow
    // functions the scope detector missed, e.g. askInput/askMultiline wizard patterns)
    const insideScope = allScopes.some(s => w.line >= s.startLine && w.line <= s.endLine);
    if (insideScope) return false;
    return true;
  });

  // Separate the content area container from other screen-level widgets
  const otherNodes = [];
  for (const w of nonTabWidgets) {
    // Skip content area (parent of tabs)
    const isContentArea = parsed.tabFactories.some(t => {
      const tabWidget = parsed.widgets.find(tw => tw.scope === t.name && tw.varName === 'container');
      return tabWidget && tabWidget.parentVar === w.varName;
    });
    if (isContentArea) continue;

    // Skip original tab bar — replaced by our generated Pressable tab bar
    const top = String(w.options.top || '').replace(/^['"]|['"]$/g, '');
    const height = String(w.options.height || '').replace(/^['"]|['"]$/g, '');
    const left = String(w.options.left || '').replace(/^['"]|['"]$/g, '');
    if (top === '0' && (height === '1' || height === '2')) continue;

    // Skip centered overlay widgets (dialogs/modals — should be state-controlled)
    if (top === 'center' && left === 'center') continue;

    const node = convertSingleWidget(w, parsed, stateWidgetMethods);
    if (node) otherNodes.push(node);
  }

  // Find footer (widget with bottom: 0)
  const footer = otherNodes.find(n => n._isFooter);
  const otherNonFooter = otherNodes.filter(n => !n._isFooter);

  const rootChildren = [
    tabBarNode,
    // Content area with tab panels
    {
      component: 'Box',
      style: { flexGrow: 1, flexDirection: 'column', backgroundColor: bgColor },
      children: tabPanels,
    },
  ];

  // Add non-tab widgets
  for (const n of otherNonFooter) rootChildren.push(n);
  if (footer) rootChildren.push(footer);

  return [{
    component: 'Box',
    style: { width: '100%', height: '100%', flexDirection: 'column', backgroundColor: bgColor },
    children: rootChildren,
  }];
}

/**
 * Build a normal root Box node wrapping the widget tree.
 */
function buildRootNode(tree, parsed, stateWidgetMethods) {
  const bgColor = resolveColor(parsed.screen?.options?._style?.base?.bg) || '#1a1b26';
  const children = convertWidgetTreeToNodes(tree, parsed, stateWidgetMethods);

  return {
    component: 'Box',
    style: { width: '100%', height: '100%', flexDirection: 'column', backgroundColor: bgColor },
    children,
  };
}

/**
 * Build a parent→children tree from flat widget list.
 * Uses scopedName for unique identity, varName or scopedName for parent resolution.
 */
function buildWidgetTree(widgets, screenVar) {
  const tree = [];
  const byName = {};
  for (const w of widgets) {
    byName[w.scopedName || w.varName] = { ...w, children: [] };
  }
  // Also index by varName for parent lookup
  const byVar = {};
  for (const w of widgets) {
    if (!byVar[w.varName]) byVar[w.varName] = [];
    byVar[w.varName].push(byName[w.scopedName || w.varName]);
  }

  for (const w of widgets) {
    const node = byName[w.scopedName || w.varName];
    const parentVar = w.parentVar;
    if (!parentVar || parentVar === screenVar) {
      tree.push(node);
    } else {
      // Try to find parent by scopedName first, then by varName in same scope
      let parent = byName[parentVar];
      if (!parent) {
        // Find parent by varName — prefer same scope
        const candidates = byVar[parentVar] || [];
        parent = candidates.find(c => c.scope === w.scope) || candidates[0];
      }
      if (parent) {
        parent.children.push(node);
      } else {
        tree.push(node);
      }
    }
  }

  return tree;
}

/**
 * Infer flex direction from children positioning.
 */
function inferDirection(children) {
  if (children.length <= 1) return 'column';
  const lefts = children.map(c => c.options?.left).filter(Boolean);
  const tops = children.map(c => c.options?.top).filter(Boolean);

  if (lefts.length >= 2) {
    const uniqLefts = new Set(lefts.map(l => String(l).replace(/^['"]|['"]$/g, '')));
    if (uniqLefts.size > 1) {
      const topSet = new Set(tops.map(t => String(t).replace(/^['"]|['"]$/g, '')));
      if (topSet.size <= 1) return 'row';
    }
  }
  return 'column';
}

/**
 * Convert a raw widget tree to WidgetNode[] (IR format).
 */
function convertWidgetTreeToNodes(tree, parsed, stateWidgetMethods) {
  const nodes = [];
  for (const widget of tree) {
    const node = convertSingleWidget(widget, parsed, stateWidgetMethods);
    if (node) nodes.push(node);
  }
  return nodes;
}

/**
 * Convert a single widget + children to a WidgetNode.
 */
function convertSingleWidget(widget, parsed, stateWidgetMethods) {
  const mapping = widget.isContrib ? CONTRIB_MAP[widget.type] : WIDGET_MAP[widget.type];
  if (!mapping || !mapping.component) return null;

  const { style, hoverStyle } = convertWidgetStyles(widget);
  const events = buildEventObj(widget, parsed);
  const methods = stateWidgetMethods[widget.varName];

  // Infer direction for containers
  if (widget.children?.length > 0 && (mapping.component === 'Box' || mapping.component === 'ScrollView')) {
    style.flexDirection = inferDirection(widget.children);
  }

  // Label
  const label = widget.options.label?.replace(/^['"]|['"]$/g, '').replace(/^\s+|\s+$/g, '');

  // Check if this is a footer (bottom: 0)
  const isFooter = widget.options.bottom === '0' || widget.options.bottom === 0;

  // Build node based on type
  const node = { component: mapping.component, style, label };
  if (Object.keys(hoverStyle).length > 0) node.hoverStyle = hoverStyle;
  if (Object.keys(events).length > 0) node.events = events;
  if (isFooter) node._isFooter = true;

  const children = convertWidgetTreeToNodes(widget.children || [], parsed, stateWidgetMethods);

  switch (mapping.type) {
    case 'text': {
      const content = resolveContent(widget, parsed);
      const fontSize = mapping.big ? 48 : undefined;
      if (fontSize) node.style.fontSize = fontSize;
      node.textContent = content;
      return node;
    }

    case 'divider': {
      const isVertical = widget.options.orientation?.includes('vert');
      node.style = isVertical
        ? { width: 1, height: '100%', backgroundColor: style.borderColor || '#555' }
        : { width: '100%', height: 1, backgroundColor: style.borderColor || '#555' };
      return node;
    }

    case 'button': {
      node.component = 'Pressable';
      const content = resolveContent(widget, parsed);
      node.children = [{
        component: 'Text',
        style: { color: style.color || '#FFF' },
        textContent: content,
      }];
      return node;
    }

    case 'input': {
      node.component = 'TextInput';
      const placeholder = label || '';
      node.props = { placeholder: `"${placeholder}"` };
      if (mapping.multiline) node.props.multiline = '{true}';
      return node;
    }

    case 'list': {
      node.component = 'ScrollView';
      const items = widget.options._items || [];
      const isStateful = methods?.has('setItems') || methods?.has('addItem');
      const itemsExpr = isStateful ? `${widget.varName}Items` : JSON.stringify(items);
      node.children = [{
        component: 'Box',
        isMap: { collection: itemsExpr, itemVar: 'item' },
        children: [{
          component: 'Pressable',
          props: { 'key': '{i}' },
          events: widget.events.find(e => e.event === 'select')
            ? { onClick: '() => { /* select handler */ }' }
            : {},
          children: [{ component: 'Text', textContent: '{item}' }],
        }],
      }];
      return node;
    }

    case 'table': {
      node.component = 'ScrollView';
      // Try to find setData mutation with data
      const dataMutation = parsed.mutations.find(m =>
        m.target === widget.varName && m.method === 'setData' && m.dataArg
      );
      if (dataMutation) {
        const headers = parseTableHeaders(dataMutation.dataArg, parsed._source, dataMutation.line);
        node.tableData = {
          headers,
          rows: `/* data from ${widget.varName}.setData() — bind to state */`,
        };
      } else {
        node.tableData = { headers: ['Column 1', 'Column 2'], rows: null };
      }
      return node;
    }

    case 'progress': {
      const barStyle = widget.options._style?.bar || {};
      const barColor = resolveColor(barStyle.bg) || '#3B82F6';
      const progressVar = findProgressVar(widget, parsed);
      node.children = [{
        component: 'Box',
        style: { width: `\`\${${progressVar || 42}}%\``, height: '100%', backgroundColor: barColor, borderRadius: 2 },
      }];
      return node;
    }

    case 'log': {
      node.component = 'ScrollView';
      const isStateful = methods?.has('setContent') || methods?.has('log') || methods?.has('add');
      const contentRef = isStateful ? `{${widget.varName}Content}` : "{''}";
      node.children = [{ component: 'Text', textContent: contentRef }];
      return node;
    }

    case 'chart': {
      node.comment = `blessed-contrib ${mapping.chartType} chart — needs manual conversion`;
      node.children = [{ component: 'Text', style: { color: '#888' }, textContent: `Chart: ${mapping.chartType}` }];
      return node;
    }

    case 'modal': {
      node.component = 'Modal';
      // Move label to title prop instead of standalone <Text>
      if (node.label) {
        node.props = { visible: '{false}', onClose: '{() => {}}', title: `"${escapeStr(stripBlessedTags(node.label))}"` };
        node.label = null;
      } else {
        node.props = { visible: '{false}', onClose: '{() => {}}' };
      }
      node.children = [{ component: 'Box', style, children }];
      return node;
    }

    case 'image': {
      node.component = 'Image';
      const file = widget.options.file?.replace(/^['"]|['"]$/g, '') || 'placeholder';
      node.props = { src: `"${file}"` };
      return node;
    }

    case 'terminal': {
      node.comment = 'Terminal widget — needs manual conversion';
      node.children = [{ component: 'Text', style: { color: '#888' }, textContent: 'Terminal (needs manual conversion)' }];
      return node;
    }

    default:
      break;
  }

  // Generic container
  const content = resolveContent(widget, parsed);
  if (content) {
    node.children = [
      { component: 'Text', style: { color: style.color || '#FFF' }, textContent: content },
      ...children,
    ];
  } else {
    node.children = children;
  }

  return node;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function resolveContent(widget, parsed) {
  const opts = widget.options;
  let content = opts.content?.replace(/^['"`]|['"`]$/g, '') || '';
  content = stripBlessedTags(content);
  const isStateful = parsed.mutations.some(m =>
    m.target === widget.varName &&
    (m.method === 'setContent' || m.method === 'log' || m.method === 'add')
  );
  if (isStateful) return `{${widget.varName}Content}`;
  return content;
}

function buildEventObj(widget, parsed) {
  const events = {};
  for (const ev of widget.events) {
    const handler = convertHandler(ev.handler, parsed);
    switch (ev.event) {
      case 'click': case 'press':
        events.onClick = `() => { ${handler} }`;
        break;
      case 'submit':
        events.onKeyDown = `(e) => { if (e.key === 'Enter') { ${handler} } }`;
        break;
      case 'focus':
        events.onFocus = `() => { ${handler} }`;
        break;
      case 'blur':
        events.onBlur = `() => { ${handler} }`;
        break;
      case 'select':
        // Handled per-item in list generation
        break;
      default:
        break;
    }
  }
  return events;
}

function convertHandler(body, parsed) {
  if (!body) return '';
  let result = body.trim();

  // Remove screen.render() / scheduleRender() calls
  result = result.replace(/\b\w+\.render\(\)\s*;?/g, '');
  result = result.replace(/\bscheduleRender\(\)\s*;?/g, '');

  // Convert mutations
  result = result.replace(/(\w+)\.setContent\((.+?)\)/g, (_, target, val) =>
    `set${capitalize(target)}Content(${val})`);
  result = result.replace(/(\w+)\.setItems\((.+?)\)/g, (_, target, val) =>
    `set${capitalize(target)}Items(${val})`);
  result = result.replace(/(\w+)\.setProgress\((.+?)\)/g, (_, target, val) =>
    `set${capitalize(findProgressStateVar(target, parsed))}(${val})`);
  result = result.replace(/(\w+)\.clearValue\(\)/g, (_, target) =>
    `set${capitalize(target)}Content('')`);
  result = result.replace(/(\w+)\.toggle\(\)/g, (_, target) => `/* ${target}.toggle() */`);
  result = result.replace(/(\w+)\.(?:log|add)\((.+?)\)/g, (_, target, val) =>
    `set${capitalize(target)}Content(prev => prev + '\\n' + ${val})`);
  result = result.replace(/(\w+)\.focus\(\)/g, '/* $1.focus() */');
  result = result.replace(/(\w+)\.show\(\)/g, '/* $1.show() */');
  result = result.replace(/(\w+)\.hide\(\)/g, '/* $1.hide() */');
  result = result.replace(/(\w+)\.destroy\(\)/g, '/* $1.destroy() */');

  // Convert variable reassignments to setState
  for (const v of (parsed.variables || [])) {
    const re = new RegExp(`\\b${v.name}\\s*=\\s*(.+?)(?:;|$)`, 'gm');
    result = result.replace(re, `set${capitalize(v.name)}($1);`);
  }

  return result.trim().replace(/\n\s*\n/g, '\n');
}

/**
 * Map blessed key names to DOM-style key names for onKeyDown.
 */
function mapBlessedKey(blessedKey) {
  const map = {
    'escape': 'Escape', 'enter': 'Enter', 'return': 'Enter',
    'tab': 'Tab', 'space': ' ', 'backspace': 'Backspace', 'delete': 'Delete',
    'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
    'home': 'Home', 'end': 'End', 'pageup': 'PageUp', 'pagedown': 'PageDown',
    'f1': 'F1', 'f2': 'F2', 'f3': 'F3', 'f4': 'F4', 'f5': 'F5',
    'f6': 'F6', 'f7': 'F7', 'f8': 'F8', 'f9': 'F9', 'f10': 'F10',
    'f11': 'F11', 'f12': 'F12',
  };

  // Ctrl combinations: C-x → Ctrl+x
  if (blessedKey.startsWith('C-')) {
    return `Ctrl+${blessedKey.slice(2)}`;
  }
  // Single char keys
  if (blessedKey.length === 1) return blessedKey;
  return map[blessedKey] || null;
}

function convertFunctionBody(body, parsed) {
  const lines = body.split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\w+\.render\(\)\s*;?\s*$/.test(trimmed)) continue;
    if (/^scheduleRender\(\)\s*;?\s*$/.test(trimmed)) continue;

    let l = trimmed;
    l = l.replace(/(\w+)\.setContent\((.+?)\)/g, (_, t, v) => `set${capitalize(t)}Content(${v})`);
    l = l.replace(/(\w+)\.setItems\((.+?)\)/g, (_, t, v) => `set${capitalize(t)}Items(${v})`);
    l = l.replace(/(\w+)\.(?:log|add)\((.+?)\)/g, (_, t, v) => `set${capitalize(t)}Content(prev => prev + '\\n' + ${v})`);

    for (const v of (parsed.variables || [])) {
      const re = new RegExp(`^(\\s*)${v.name}\\s*=\\s*(.+?)(?:;|$)`);
      const match = l.match(re);
      if (match && !l.includes('const ') && !l.includes('let ') && !l.includes('==')) {
        l = `${match[1]}set${capitalize(v.name)}(${match[2].trim()});`;
      }
    }
    out.push(l);
  }
  return out.join('\n');
}

function findProgressVar(widget, parsed) {
  for (const fn of parsed.functions) {
    const match = fn.body.match(new RegExp(`${widget.varName}\\.setProgress\\((\\w+)\\)`));
    if (match) return match[1];
  }
  for (const ev of [...widget.events, ...parsed.events]) {
    const match = ev.handler?.match(new RegExp(`${widget.varName}\\.setProgress\\((\\w+)\\)`));
    if (match) return match[1];
  }
  return 'progress';
}

function findProgressStateVar(target, parsed) {
  return 'progress';
}

/**
 * Parse table headers from a setData() argument.
 * Handles: setData([headers, ...rows]), setData({headers, data}), setData(varName)
 *
 * @param {string} dataArg - The argument to setData()
 * @param {string} source - Full source code (for variable tracing)
 * @param {number} mutationLine - Line number of the setData() call
 */
function parseTableHeaders(dataArg, source, mutationLine) {
  if (!dataArg) return ['Column 1', 'Column 2'];

  // Array of arrays format: [['H1','H2'], ...rows]
  const arrayMatch = dataArg.match(/^\[\s*\[([^\]]+)\]/);
  if (arrayMatch) {
    return arrayMatch[1].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, ''));
  }

  // Object format: { headers: ['H1','H2'], data: ... }
  const headersMatch = dataArg.match(/headers\s*:\s*\[([^\]]+)\]/);
  if (headersMatch) {
    return headersMatch[1].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, ''));
  }

  // Variable reference: setData(varName) — trace backward to find definition
  if (source && /^\w+$/.test(dataArg.trim())) {
    const varName = dataArg.trim();
    const lines = source.split('\n');
    // Search backward from mutation line for `const/let/var varName = [`
    const startLine = Math.max(0, (mutationLine || lines.length) - 50);
    const endLine = mutationLine || lines.length;
    for (let i = endLine - 1; i >= startLine; i--) {
      const varDef = lines[i].match(new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*\\[`));
      if (varDef) {
        // Found the definition — look for the first sub-array (headers)
        const fromDef = lines.slice(i).join('\n');
        const headerMatch = fromDef.match(/=\s*\[\s*\n?\s*\[([^\]]+)\]/);
        if (headerMatch) {
          return headerMatch[1].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, ''));
        }
      }
    }
  }

  return ['Column 1', 'Column 2'];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN ENTRY: PARSE → IR → ASSEMBLE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateReactJIT(parsed) {
  const ir = buildIR(parsed);
  return assembleComponent(ir);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLI ENTRY POINT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function migrateBlessedCommand(args) {
  const helpMode = args.includes('--help') || args.includes('-h');
  const dryRun = args.includes('--dry-run');
  const scaffoldIdx = args.indexOf('--scaffold');
  const outputIdx = args.indexOf('--output');
  const shortOutputIdx = args.indexOf('-o');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : (shortOutputIdx !== -1 ? args[shortOutputIdx + 1] : null);

  // --scaffold [name] — next arg is project name if it doesn't start with -
  const scaffoldName = scaffoldIdx !== -1
    ? (args[scaffoldIdx + 1] && !args[scaffoldIdx + 1].startsWith('-') ? args[scaffoldIdx + 1] : null)
    : null;
  const scaffoldMode = scaffoldIdx !== -1;

  if (helpMode) {
    console.log(`
  rjit migrate-blessed — Convert Blessed terminal UI apps to ReactJIT

  Usage:
    rjit migrate-blessed <file.js>                       Convert and print to stdout
    rjit migrate-blessed <file.js> --output out.tsx       Write to file
    rjit migrate-blessed <file.js> --scaffold [name]      Convert + create a new project
    rjit migrate-blessed <file.js> --dry-run              Show analysis only

  Features:
    - UI/backend separation: only blessed UI code is converted
    - Tab system detection: factory pattern → tab components
    - Scope-aware: same-named widgets in different functions are handled correctly
    - Table data: setData() headers and rows are preserved
    - Blessed tag stripping: {bold}, {red-fg}, etc. → clean text
`);
    return;
  }

  if (scaffoldMode && outputFile) {
    console.error('  --scaffold and --output are mutually exclusive.');
    process.exit(1);
  }

  // Find input file (skip flag values)
  const skipArgs = new Set([outputFile, scaffoldName].filter(Boolean));
  const fileArg = args.find(a => !a.startsWith('-') && !skipArgs.has(a));
  if (!fileArg) {
    console.error('No input file specified. Use --help for usage.');
    process.exit(1);
  }

  let input;
  try {
    input = readFileSync(fileArg, 'utf-8');
  } catch (err) {
    console.error(`Error reading file: ${fileArg}`);
    process.exit(1);
  }

  const parsed = parseBlessedSource(input);

  if (dryRun) {
    printDryRun(fileArg, parsed);
    return;
  }

  const result = generateReactJIT(parsed);

  if (scaffoldMode) {
    const projectName = scaffoldName || deriveProjectName(fileArg);
    const dest = join(process.cwd(), projectName);
    console.log(`\n  Converting ${fileArg} → new project: ${projectName}/`);
    scaffoldProject(dest, {
      name: projectName,
      appTsx: result.code,
    });
    console.log(`  ${result.stats.widgets} widgets, ${result.stats.events} events, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings.slice(0, 10)) console.log(`    ${w}`);
    }
    console.log(`\n  Next steps:`);
    console.log(`    cd ${projectName}`);
    console.log(`    reactjit dev\n`);
  } else if (outputFile) {
    writeFileSync(outputFile, result.code, 'utf-8');
    console.log(`  Converted ${fileArg} → ${outputFile}`);
    console.log(`  ${result.stats.widgets} widgets, ${result.stats.events} events, ${result.stats.functions} functions`);
    console.log(`  Components: ${result.components.join(', ')}`);
    if (parsed.tabFactories.length > 0) {
      console.log(`  Tabs: ${parsed.tabFactories.map(t => t.title).join(', ')}`);
    }
    if (parsed.businessLogicFunctions.length > 0) {
      console.log(`  Skipped ${parsed.businessLogicFunctions.length} backend functions (not UI)`);
    }
    if (result.warnings.length > 0) {
      console.log(`  ${result.warnings.length} warning(s):`);
      for (const w of result.warnings.slice(0, 20)) console.log(`    ${w}`);
    }
  } else {
    process.stdout.write(result.code);
    if (process.stderr.isTTY) {
      console.error(`\n--- ${result.stats.widgets} widgets | ${result.components.join(', ')} | ${result.warnings.length} warning(s) ---`);
    }
  }
}

function printDryRun(fileArg, parsed) {
  console.log(`\n  Analysis of ${fileArg}:\n`);
  console.log(`  Screen: ${parsed.screen?.varName || '(none)'}`);
  if (parsed.screen?.options?.title) console.log(`    Title: ${parsed.screen.options.title}`);

  console.log(`\n  UI Boundary: line ${parsed.widgets[0]?.line || '?'} (${parsed.widgets.length} widgets after screen)`);

  console.log(`\n  Widgets: ${parsed.widgets.length}`);
  const screenVar = parsed.screen?.varName || 'screen';
  const tree = buildWidgetTree(parsed.widgets, screenVar);
  printWidgetTree(tree, '    ');

  if (parsed.tabFactories.length > 0) {
    console.log(`\n  Tab Factories: ${parsed.tabFactories.length}`);
    for (const tab of parsed.tabFactories) {
      console.log(`    ${tab.name} → "${tab.title}" (${tab.widgets.length} widgets)`);
    }
  }

  const eventCount = parsed.widgets.reduce((s, w) => s + w.events.length, 0) + parsed.events.length;
  console.log(`\n  Events: ${eventCount}`);
  for (const w of parsed.widgets) {
    for (const ev of w.events) console.log(`    ${w.varName}.on('${ev.event}')`);
  }

  console.log(`\n  Keybindings: ${parsed.keybindings.length}`);
  for (const kb of parsed.keybindings) console.log(`    ${kb.target}.key([${kb.keys.join(', ')}])`);

  console.log(`\n  UI Functions: ${parsed.functions.length}`);
  for (const fn of parsed.functions) console.log(`    ${fn.name}(${fn.args})`);

  console.log(`\n  Backend Functions (skipped): ${parsed.businessLogicFunctions.length}`);
  for (const fn of parsed.businessLogicFunctions.slice(0, 10)) console.log(`    ${fn.name}(${fn.args})`);
  if (parsed.businessLogicFunctions.length > 10) console.log(`    ... and ${parsed.businessLogicFunctions.length - 10} more`);

  console.log(`\n  UI Variables: ${(parsed.variables || []).length}`);
  for (const v of (parsed.variables || [])) {
    console.log(`    ${v.name} = ${v.value.slice(0, 40)}${v.value.length > 40 ? '...' : ''}`);
  }

  console.log(`\n  Mutations: ${parsed.mutations.length}`);
  for (const m of parsed.mutations) console.log(`    ${m.target}.${m.method}()`);

  if (parsed.contribGrid) console.log(`\n  blessed-contrib grid detected`);
  if (parsed.warnings.length > 0) {
    console.log(`\n  Warnings:`);
    for (const w of parsed.warnings) console.log(`    ${w}`);
  }
  console.log('');
}

function printWidgetTree(tree, prefix) {
  for (const node of tree) {
    const evStr = node.events?.length > 0 ? ` [${node.events.map(e => e.event).join(', ')}]` : '';
    const parentStr = node.parentVar ? ` (parent: ${node.parentVar})` : '';
    const scopeStr = node.scope ? ` {${node.scope}}` : '';
    console.log(`${prefix}${node.varName}: ${node.type}${parentStr}${evStr}${scopeStr}`);
    if (node.children?.length > 0) printWidgetTree(node.children, prefix + '  ');
  }
}
