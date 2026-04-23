#!/usr/bin/env node
/**
 * tslx_compile.mjs — primitive compiler for reactjit.
 *
 * One source of truth per primitive: `framework/primitives/<name>.tslx`.
 * Running `node scripts/tslx_compile.mjs --all` regenerates every derived
 * artifact — paint function, TSX wrapper, Node struct fields, row struct,
 * intrinsic-height rules, JSON prop parsers, applyTypeDefaults branch,
 * applyProps branches. Adding a new primitive is one .tslx file, nothing
 * else. No hand-pasting into layout.zig / qjs_app.zig ever again.
 *
 * Layout:
 *   framework/primitives/<name>.tslx                    — source
 *   framework/primitives/generated/<name>.zig           — paint fn + row struct
 *   runtime/primitives_gen/<Name>.tsx                   — React wrapper
 *   framework/layout.zig                                 — auto-spliced between GEN markers
 *   qjs_app.zig                                          — auto-spliced between GEN markers
 *
 * Splice markers (both files):
 *   // tslx:GEN:<SECTION> START
 *   ... anything here is regenerated on every compile ...
 *   // tslx:GEN:<SECTION> END
 *
 * Sections in framework/layout.zig:
 *   ROW_TYPES                — top-level `pub const <RowName> = struct { ... };` defs
 *   NODE_FIELDS              — Node struct fields for each primitive
 *   INTRINSIC_HEIGHT         — estimateIntrinsicHeight h-resolution checks
 *   INTRINSIC_HEIGHT_FALLBACK — layoutNode h==null fallback checks
 *
 * Sections in qjs_app.zig:
 *   PARSERS                  — `fn parse<X>Rows(...)` functions per row_type
 *   TYPE_DEFAULTS            — `else if (eq(u8, type_name, "<Name>")) { ... }` branches
 *   PROPS                    — `else if (guard != null and key == "...")` branches
 *
 * Spec grammar (indent-sensitive, `end` closes blocks):
 *
 *   primitive <Name>
 *     guard_field: <snake_name>
 *     row_type <ZigName>
 *       <field>: <zig_type> = <default>
 *       ...
 *     end
 *     fields
 *       <name>: <zig_type> = <default>
 *       ...
 *     end
 *     props
 *       <jsName>: <parser> -> <field>
 *       ...
 *     end
 *     intrinsic_height: <zig-expr>          # `gr` binds to the rows slice
 *     paint
 *       <verbatim Zig>
 *     end
 *   end
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

// ── Parser ─────────────────────────────────────────────────────

function parseTslx(src, filename) {
  const lines = src.split('\n');
  const spec = { fields: [], props: [], row_type: null };
  let i = 0;
  const err = (msg) => { throw new Error(`${filename}:${i + 1}: ${msg}`); };

  while (i < lines.length && !lines[i].trim()) i++;
  const primMatch = lines[i]?.match(/^primitive\s+(\w+)\s*$/);
  if (!primMatch) err(`expected 'primitive <Name>' as first non-blank line`);
  spec.name = primMatch[1];
  i++;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { i++; continue; }
    if (trimmed === 'end') { i++; break; }

    const kv = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
    if (kv && !['props', 'fields', 'paint', 'row_type'].includes(kv[1])) {
      spec[kv[1]] = kv[2].trim();
      i++;
      continue;
    }

    const rtMatch = trimmed.match(/^row_type\s+(\w+)\s*$/);
    if (rtMatch) {
      spec.row_type = { name: rtMatch[1], fields: [] };
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        const t = lines[i].trim();
        if (t) {
          const fm = t.match(/^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
          if (!fm) err(`bad row_type field: ${t}`);
          spec.row_type.fields.push({
            name: fm[1].trim(),
            type: fm[2].trim(),
            default: fm[3]?.trim() ?? null,
          });
        }
        i++;
      }
      i++;
      continue;
    }

    if (trimmed === 'fields') {
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        const t = lines[i].trim();
        if (t) {
          const fm = t.match(/^(\w+)\s*:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
          if (!fm) err(`bad field: ${t}`);
          spec.fields.push({
            name: fm[1].trim(),
            type: fm[2].trim(),
            default: fm[3]?.trim() ?? null,
          });
        }
        i++;
      }
      i++;
      continue;
    }

    if (trimmed === 'props') {
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        const t = lines[i].trim();
        if (t) {
          const pm = t.match(/^(\w+)\s*:\s*(.+?)\s*->\s*(\w+)\s*$/);
          if (!pm) err(`bad prop: ${t}  (expected 'jsName: parser -> field')`);
          spec.props.push({ js_name: pm[1], parser: pm[2].trim(), field: pm[3] });
        }
        i++;
      }
      i++;
      continue;
    }

    if (trimmed === 'paint') {
      const body = [];
      i++;
      while (i < lines.length && lines[i].trim() !== 'end') {
        body.push(lines[i]);
        i++;
      }
      spec.paint = body.join('\n');
      i++;
      continue;
    }

    err(`unexpected line: ${trimmed}`);
  }

  if (!spec.name) err('missing primitive name');
  if (!spec.guard_field) err('missing guard_field');
  if (!spec.paint) err('missing paint block');
  return spec;
}

// ── Emitters ────────────────────────────────────────────────────

const toSnake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

function emitRowStruct(spec) {
  if (!spec.row_type) return '';
  const lines = spec.row_type.fields.map((f) => {
    const d = f.default == null ? '' : ` = ${f.default}`;
    return `    ${f.name}: ${f.type}${d},`;
  });
  return `pub const ${spec.row_type.name} = struct {\n${lines.join('\n')}\n};\n`;
}

function emitPaintFile(spec, pastePath) {
  const body = spec.paint.replace(/^\n+|\n+$/g, '');
  return `//! Generated by scripts/tslx_compile.mjs from ${pastePath}.
//! Do NOT edit by hand — edit the .tslx source and recompile.
//!
//! Primitive: ${spec.name}
//! Guard field: node.${spec.guard_field}

const std = @import("std");
const layout = @import("../../layout.zig");
const gpu = @import("../../gpu/gpu.zig");
const Node = layout.Node;
const Color = layout.Color;
${spec.row_type ? `const ${spec.row_type.name} = layout.${spec.row_type.name};\n` : ''}
/// Paint ${spec.name}. Caller has already verified node.${spec.guard_field} is active.
pub fn paint${spec.name}(node: *Node, g_paint_opacity: f32) void {
${body}
}
`;
}

function emitTsxWrapper(spec) {
  const propLines = spec.props.map((p) => ` *   ${p.js_name}`).join('\n');
  return `/**
 * ${spec.name} — generated by scripts/tslx_compile.mjs.
 *
 * Bulk-rendering primitive: one React host node that the framework
 * paints natively in Zig from data-in props. Do NOT pass children.
 *
 * Props:
${propLines}
 */
// Lazy require — see runtime/primitives.tsx header for why init-time capture
// of React breaks under esbuild's inject/react-body cycle.
export const ${spec.name}: any = (props: any) => require('react').createElement('${spec.name}', props);
`;
}

// Zig type → JSON parser statement for a field assignment.
function parseStatementForType(zigType, target) {
  const t = zigType.replace(/^\s*\?/, '').trim();
  if (t === 'f32' || t === 'f64') return `if (jsonFloat(v_)) |f| ${target} = f;`;
  if (t === 'bool') return `if (jsonBool(v_)) |b| ${target} = b;`;
  if (t === 'Color') return `if (v_ == .string) ${target} = parseColor(v_.string);`;
  if (t === '?Color' || t === 'Color') return `if (v_ == .string) ${target} = parseColor(v_.string);`;
  if (t === '[]const u8') return `if (dupJsonText(v_)) |s| ${target} = s;`;
  // Integer types: u8 u16 u32 u64 i8 i16 i32 i64 usize isize
  if (/^(u|i)\d+$|^usize$|^isize$/.test(t)) {
    return `if (jsonInt(v_)) |i| ${target} = @intCast(@max(0, i));`;
  }
  // Fallback — user can override via raw parser later
  return `// unknown type ${zigType} — add a case in scripts/tslx_compile.mjs parseStatementForType`;
}

function emitRowsParser(spec) {
  if (!spec.row_type) return '';
  const rt = spec.row_type.name;
  const fnName = `parse${rt}s`;
  const fieldAssigns = spec.row_type.fields
    .filter((f) => !f.name.startsWith('_'))
    .map((f) => {
      const parse = parseStatementForType(f.type, `row.${f.name}`);
      return `        if (row_v.object.get("${f.name}")) |v_| { ${parse} }`;
    })
    .join('\n');

  return `fn ${fnName}(v: std.json.Value) ?[]const layout.${rt} {
    if (v != .array) return null;
    const out = g_alloc.alloc(layout.${rt}, v.array.items.len) catch return null;
    for (v.array.items, 0..) |row_v, idx| {
        var row: layout.${rt} = .{};
        if (row_v == .object) {
${fieldAssigns}
        }
        out[idx] = row;
    }
    return out;
}`;
}

// Expand a prop parser spec into the Zig setter statement.
function expandParserExpr(expr, field, rowType) {
  const e = expr.trim();
  const target = `node.${field}`;
  if (e === 'jsonFloat') return `if (jsonFloat(v)) |f| ${target} = f;`;
  if (e === 'jsonInt') return `if (jsonInt(v)) |i| ${target} = @intCast(@max(0, i));`;
  if (e === 'jsonBool') return `if (jsonBool(v)) |b| ${target} = b;`;
  if (e === 'parseColor') return `if (v == .string) ${target} = parseColor(v.string);`;
  if (e === 'dupJsonText') return `if (dupJsonText(v)) |s| ${target} = s;`;
  if (e === 'rows' && rowType) return `${target} = parse${rowType}s(v);`;
  const callMatch = e.match(/^(\w+)\((v)\)$/);
  if (callMatch) return `${target} = ${callMatch[1]}(v);`;
  return e.replace(/\{field\}/g, target);
}

// All emitters produce content at indent level 0 ("as if at file-top").
// The splice engine reads the marker line's own indent and prefixes every
// non-empty content line with it. Nested content (struct/function bodies,
// inner branches) keeps its RELATIVE indent (4 spaces per level).

function emitNodeFields(spec) {
  return spec.fields.map((f) => {
    const d = f.default == null ? '' : ` = ${f.default}`;
    return `${f.name}: ${f.type}${d},`;
  }).join('\n');
}

function emitIntrinsicHeightCheck(spec) {
  if (!spec.intrinsic_height) return '';
  return `if (node.${spec.guard_field}) |gr| {
    return ${spec.intrinsic_height} + pt + pb;
}`;
}

function emitIntrinsicHeightFallbackCheck(spec) {
  if (!spec.intrinsic_height) return '';
  return `if (node.${spec.guard_field}) |gr| {
    h = ${spec.intrinsic_height} + pt + pb;
} else`;
}

function emitTypeDefault(spec) {
  const rowTypeName = spec.row_type?.name ?? 'u8';
  return `} else if (eq(u8, type_name, "${spec.name}")) {
    node.${spec.guard_field} = &[_]layout.${rowTypeName}{};`;
}

function emitPropsBranches(spec) {
  const rowType = spec.row_type?.name ?? null;
  const branches = spec.props.map((p, idx) => {
    // First branch in the whole PROPS block doesn't get a leading `}`;
    // it chains onto the preceding `}` (outside the splice markers).
    // The chain driver prefixes '} ' where needed when joining primitives.
    return `else if (node.${spec.guard_field} != null and std.mem.eql(u8, k, "${p.js_name}")) {
    ${expandParserExpr(p.parser, p.field, rowType)}`;
  });
  // Join branches with a closing `}` before each subsequent `else if`
  // so the cascade is syntactically closed.
  return branches.join('\n} ') + '\n}';
}

// ── Splice engine ──────────────────────────────────────────────

const MARKER_RE = (section) => new RegExp(
  String.raw`([ \t]*)// tslx:GEN:${section} START[\s\S]*?// tslx:GEN:${section} END`,
  'g'
);

function splice(filePath, section, generated) {
  const src = fs.readFileSync(filePath, 'utf-8');
  const re = MARKER_RE(section);
  if (!re.test(src)) {
    throw new Error(`${filePath}: missing splice markers for section '${section}'. Expected '// tslx:GEN:${section} START' and '// tslx:GEN:${section} END'.`);
  }
  // Reset the regex and do the actual replacement
  re.lastIndex = 0;
  const next = src.replace(re, (_match, indent) => {
    const indented = generated
      ? generated.split('\n').map((l) => l.length ? indent + l : l).join('\n')
      : '';
    return `${indent}// tslx:GEN:${section} START\n${indented}\n${indent}// tslx:GEN:${section} END`;
  });
  if (next !== src) fs.writeFileSync(filePath, next);
  return next !== src;
}

// ── Driver ─────────────────────────────────────────────────────

function compileAll() {
  const dir = path.resolve(REPO, 'framework/primitives');
  const specs = [];
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.tslx')) continue;
      const srcPath = path.join(dir, name);
      const relSrc = path.relative(REPO, srcPath);
      const spec = parseTslx(fs.readFileSync(srcPath, 'utf-8'), relSrc);
      spec.__relSrc = relSrc;
      specs.push(spec);

      // Per-primitive outputs (paint.zig + wrapper.tsx)
      const paintOutDir = path.resolve(REPO, 'framework/primitives/generated');
      fs.mkdirSync(paintOutDir, { recursive: true });
      const paintOutPath = path.join(paintOutDir, toSnake(spec.name) + '.zig');
      fs.writeFileSync(paintOutPath, emitPaintFile(spec, relSrc));

      const wrapperDir = path.resolve(REPO, 'runtime/primitives_gen');
      fs.mkdirSync(wrapperDir, { recursive: true });
      const wrapperPath = path.join(wrapperDir, spec.name + '.tsx');
      fs.writeFileSync(wrapperPath, emitTsxWrapper(spec));
    }
  }

  // ── layout.zig splices ──
  const layoutPath = path.resolve(REPO, 'framework/layout.zig');
  const rowTypesBlock = specs
    .filter((s) => s.row_type)
    .map((s) => emitRowStruct(s).trimEnd())
    .join('\n\n');
  const nodeFieldsBlock = specs.map(emitNodeFields).join('\n');
  const ihBlock = specs.map(emitIntrinsicHeightCheck).filter(Boolean).join('\n');
  const ihFallback = specs.map(emitIntrinsicHeightFallbackCheck).filter(Boolean).join('\n');

  splice(layoutPath, 'ROW_TYPES', rowTypesBlock);
  splice(layoutPath, 'NODE_FIELDS', nodeFieldsBlock);
  splice(layoutPath, 'INTRINSIC_HEIGHT', ihBlock);
  splice(layoutPath, 'INTRINSIC_HEIGHT_FALLBACK', ihFallback);

  // ── qjs_app.zig splices ──
  const qjsPath = path.resolve(REPO, 'qjs_app.zig');
  const parsersBlock = specs.map(emitRowsParser).filter(Boolean).join('\n\n');
  const typeDefaultsBlock = specs.map(emitTypeDefault).join('\n');
  const propsBlock = specs.map((s) => {
    const branches = emitPropsBranches(s);
    return `        // ── ${s.name} primitive props ──\n${branches}`;
  }).join('\n');

  splice(qjsPath, 'PARSERS', parsersBlock);
  splice(qjsPath, 'TYPE_DEFAULTS', typeDefaultsBlock);
  splice(qjsPath, 'PROPS', propsBlock);

  console.log(`[tslx-compile] ${specs.length} primitive${specs.length === 1 ? '' : 's'}: ${specs.map((s) => s.name).join(', ')}`);
}

compileAll();
