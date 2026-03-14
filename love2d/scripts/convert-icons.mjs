#!/usr/bin/env node
/**
 * convert-icons.mjs — Convert Lucide SVG icons to polyline path data.
 *
 * Reads SVG files from lucide-static, parses path/circle/line/rect/polyline/
 * polygon/ellipse elements, flattens bezier curves to line segments, and
 * outputs a TypeScript module with named exports for each icon.
 *
 * Usage: node scripts/convert-icons.mjs
 * Output: packages/icons/src/icons.ts
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ICONS_DIR = join(import.meta.dirname, '..', 'node_modules', 'lucide-static', 'icons');
const OUT_DIR = join(import.meta.dirname, '..', 'packages', 'icons', 'src');
const CURVE_SEGMENTS = 12; // segments per bezier/arc curve

// ── SVG Path Parser ──────────────────────────────────────────

function parseSvgPath(d) {
  const paths = [];
  let current = [];
  let cx = 0, cy = 0; // current point
  let sx = 0, sy = 0; // subpath start
  let prevCmd = '';
  let prevCx2 = 0, prevCy2 = 0; // previous control point for S/T

  const tokens = tokenizePath(d);
  let i = 0;

  function next() { return tokens[i++]; }
  function peek() { return tokens[i]; }
  function num() {
    const t = next();
    return parseFloat(t);
  }
  function hasMoreNums() {
    if (i >= tokens.length) return false;
    const t = peek();
    return t !== undefined && !/^[a-zA-Z]$/.test(t);
  }

  while (i < tokens.length) {
    const cmd = next();
    if (cmd === undefined) break;

    switch (cmd) {
      case 'M': {
        cx = num(); cy = num();
        sx = cx; sy = cy;
        if (current.length > 0) { paths.push(current); }
        current = [cx, cy];
        while (hasMoreNums()) { cx = num(); cy = num(); current.push(cx, cy); }
        break;
      }
      case 'm': {
        cx += num(); cy += num();
        sx = cx; sy = cy;
        if (current.length > 0) { paths.push(current); }
        current = [cx, cy];
        while (hasMoreNums()) { cx += num(); cy += num(); current.push(cx, cy); }
        break;
      }
      case 'L': {
        while (true) { cx = num(); cy = num(); current.push(cx, cy); if (!hasMoreNums()) break; }
        break;
      }
      case 'l': {
        while (true) { const dx = num(); const dy = num(); cx += dx; cy += dy; current.push(cx, cy); if (!hasMoreNums()) break; }
        break;
      }
      case 'H': {
        while (true) { cx = num(); current.push(cx, cy); if (!hasMoreNums()) break; }
        break;
      }
      case 'h': {
        while (true) { cx += num(); current.push(cx, cy); if (!hasMoreNums()) break; }
        break;
      }
      case 'V': {
        while (true) { cy = num(); current.push(cx, cy); if (!hasMoreNums()) break; }
        break;
      }
      case 'v': {
        while (true) { cy += num(); current.push(cx, cy); if (!hasMoreNums()) break; }
        break;
      }
      case 'C': {
        while (true) {
          const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num();
          flattenCubic(current, cx, cy, x1, y1, x2, y2, x, y);
          prevCx2 = x2; prevCy2 = y2;
          cx = x; cy = y;
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 'c': {
        while (true) {
          const dx1 = num(), dy1 = num(), dx2 = num(), dy2 = num(), dx = num(), dy = num();
          const x1 = cx + dx1, y1 = cy + dy1, x2 = cx + dx2, y2 = cy + dy2, x = cx + dx, y = cy + dy;
          flattenCubic(current, cx, cy, x1, y1, x2, y2, x, y);
          prevCx2 = x2; prevCy2 = y2;
          cx = x; cy = y;
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 'S': {
        while (true) {
          let x1, y1;
          if (prevCmd === 'C' || prevCmd === 'c' || prevCmd === 'S' || prevCmd === 's') {
            x1 = 2 * cx - prevCx2; y1 = 2 * cy - prevCy2;
          } else { x1 = cx; y1 = cy; }
          const x2 = num(), y2 = num(), x = num(), y = num();
          flattenCubic(current, cx, cy, x1, y1, x2, y2, x, y);
          prevCx2 = x2; prevCy2 = y2;
          cx = x; cy = y;
          prevCmd = 'S';
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 's': {
        while (true) {
          let x1, y1;
          if (prevCmd === 'C' || prevCmd === 'c' || prevCmd === 'S' || prevCmd === 's') {
            x1 = 2 * cx - prevCx2; y1 = 2 * cy - prevCy2;
          } else { x1 = cx; y1 = cy; }
          const dx2 = num(), dy2 = num(), dx = num(), dy = num();
          const x2 = cx + dx2, y2 = cy + dy2, x = cx + dx, y = cy + dy;
          flattenCubic(current, cx, cy, x1, y1, x2, y2, x, y);
          prevCx2 = x2; prevCy2 = y2;
          cx = x; cy = y;
          prevCmd = 's';
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 'Q': {
        while (true) {
          const x1 = num(), y1 = num(), x = num(), y = num();
          flattenQuadratic(current, cx, cy, x1, y1, x, y);
          prevCx2 = x1; prevCy2 = y1;
          cx = x; cy = y;
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 'q': {
        while (true) {
          const dx1 = num(), dy1 = num(), dx = num(), dy = num();
          const x1 = cx + dx1, y1 = cy + dy1, x = cx + dx, y = cy + dy;
          flattenQuadratic(current, cx, cy, x1, y1, x, y);
          prevCx2 = x1; prevCy2 = y1;
          cx = x; cy = y;
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 'T': {
        while (true) {
          let x1, y1;
          if (prevCmd === 'Q' || prevCmd === 'q' || prevCmd === 'T' || prevCmd === 't') {
            x1 = 2 * cx - prevCx2; y1 = 2 * cy - prevCy2;
          } else { x1 = cx; y1 = cy; }
          const x = num(), y = num();
          flattenQuadratic(current, cx, cy, x1, y1, x, y);
          prevCx2 = x1; prevCy2 = y1;
          cx = x; cy = y;
          prevCmd = 'T';
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 't': {
        while (true) {
          let x1, y1;
          if (prevCmd === 'Q' || prevCmd === 'q' || prevCmd === 'T' || prevCmd === 't') {
            x1 = 2 * cx - prevCx2; y1 = 2 * cy - prevCy2;
          } else { x1 = cx; y1 = cy; }
          const dx = num(), dy = num();
          const x = cx + dx, y = cy + dy;
          flattenQuadratic(current, cx, cy, x1, y1, x, y);
          prevCx2 = x1; prevCy2 = y1;
          cx = x; cy = y;
          prevCmd = 't';
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 'A': case 'a': {
        const isRel = cmd === 'a';
        while (true) {
          const rx = num(), ry = num(), rot = num(), largeArc = num(), sweep = num();
          let ex = num(), ey = num();
          if (isRel) { ex += cx; ey += cy; }
          flattenArc(current, cx, cy, rx, ry, rot, !!largeArc, !!sweep, ex, ey);
          cx = ex; cy = ey;
          if (!hasMoreNums()) break;
        }
        break;
      }
      case 'Z': case 'z': {
        if (current.length > 0) {
          current.push(sx, sy);
          paths.push(current);
          current = [];
        }
        cx = sx; cy = sy;
        break;
      }
      default:
        // Unknown command, skip
        break;
    }
    if (cmd !== 'S' && cmd !== 's' && cmd !== 'T' && cmd !== 't') {
      prevCmd = cmd;
    }
  }

  if (current.length >= 4) paths.push(current);

  return paths;
}

function tokenizePath(d) {
  const tokens = [];
  const re = /([a-zA-Z])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d)) !== null) {
    tokens.push(m[1] || m[2]);
  }
  return tokens;
}

// ── Bezier flattening ────────────────────────────────────────

function flattenCubic(out, x0, y0, x1, y1, x2, y2, x3, y3) {
  for (let i = 1; i <= CURVE_SEGMENTS; i++) {
    const t = i / CURVE_SEGMENTS;
    const mt = 1 - t;
    const x = mt*mt*mt*x0 + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3;
    const y = mt*mt*mt*y0 + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3;
    out.push(x, y);
  }
}

function flattenQuadratic(out, x0, y0, x1, y1, x2, y2) {
  for (let i = 1; i <= CURVE_SEGMENTS; i++) {
    const t = i / CURVE_SEGMENTS;
    const mt = 1 - t;
    const x = mt*mt*x0 + 2*mt*t*x1 + t*t*x2;
    const y = mt*mt*y0 + 2*mt*t*y1 + t*t*y2;
    out.push(x, y);
  }
}

// ── Arc flattening (SVG arc → endpoint → center parameterization) ──

function flattenArc(out, x1, y1, rx, ry, xRotDeg, largeArc, sweep, x2, y2) {
  if (rx === 0 || ry === 0) { out.push(x2, y2); return; }
  rx = Math.abs(rx); ry = Math.abs(ry);

  const phi = xRotDeg * Math.PI / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  let rxSq = rx * rx, rySq = ry * ry;
  const x1pSq = x1p * x1p, y1pSq = y1p * y1p;

  // Scale radii if needed
  const lambda = x1pSq / rxSq + y1pSq / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s; ry *= s;
    rxSq = rx * rx; rySq = ry * ry;
  }

  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  if (sq < 0) sq = 0;
  const root = Math.sqrt(sq) * (largeArc === sweep ? -1 : 1);

  const cxp = root * rx * y1p / ry;
  const cyp = -root * ry * x1p / rx;

  const cxr = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cyr = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vecAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);

  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const steps = Math.max(CURVE_SEGMENTS, Math.ceil(Math.abs(dTheta) / (Math.PI / 8)));
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + dTheta * (i / steps);
    const xr = rx * Math.cos(t), yr = ry * Math.sin(t);
    out.push(cosPhi * xr - sinPhi * yr + cxr, sinPhi * xr + cosPhi * yr + cyr);
  }
}

function vecAngle(ux, uy, vx, vy) {
  const dot = ux * vx + uy * vy;
  const len = Math.sqrt(ux*ux + uy*uy) * Math.sqrt(vx*vx + vy*vy);
  let ang = Math.acos(Math.max(-1, Math.min(1, dot / len)));
  if (ux * vy - uy * vx < 0) ang = -ang;
  return ang;
}

// ── SVG Element Converters ───────────────────────────────────

function parseCircle(attrs) {
  const cx = parseFloat(attrs.cx || 0);
  const cy = parseFloat(attrs.cy || 0);
  const r = parseFloat(attrs.r || 0);
  if (r <= 0) return [];
  const pts = [];
  const steps = CURVE_SEGMENTS * 3; // more segments for full circle
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return [pts];
}

function parseEllipse(attrs) {
  const cx = parseFloat(attrs.cx || 0);
  const cy = parseFloat(attrs.cy || 0);
  const rx = parseFloat(attrs.rx || 0);
  const ry = parseFloat(attrs.ry || 0);
  if (rx <= 0 || ry <= 0) return [];
  const pts = [];
  const steps = CURVE_SEGMENTS * 3;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return [pts];
}

function parseLine(attrs) {
  const x1 = parseFloat(attrs.x1 || 0), y1 = parseFloat(attrs.y1 || 0);
  const x2 = parseFloat(attrs.x2 || 0), y2 = parseFloat(attrs.y2 || 0);
  return [[x1, y1, x2, y2]];
}

function parseRect(attrs) {
  const x = parseFloat(attrs.x || 0), y = parseFloat(attrs.y || 0);
  const w = parseFloat(attrs.width || 0), h = parseFloat(attrs.height || 0);
  const rx = parseFloat(attrs.rx || 0), ry = parseFloat(attrs.ry || rx);
  if (w <= 0 || h <= 0) return [];

  if (rx > 0 || ry > 0) {
    const r = Math.min(rx, w / 2);
    const rr = Math.min(ry, h / 2);
    const pts = [];
    // Top edge (left to right)
    pts.push(x + r, y);
    pts.push(x + w - r, y);
    // Top-right corner
    flattenArc(pts, x + w - r, y, r, rr, 0, false, true, x + w, y + rr);
    // Right edge
    pts.push(x + w, y + h - rr);
    // Bottom-right corner
    flattenArc(pts, x + w, y + h - rr, r, rr, 0, false, true, x + w - r, y + h);
    // Bottom edge
    pts.push(x + r, y + h);
    // Bottom-left corner
    flattenArc(pts, x + r, y + h, r, rr, 0, false, true, x, y + h - rr);
    // Left edge
    pts.push(x, y + rr);
    // Top-left corner
    flattenArc(pts, x, y + rr, r, rr, 0, false, true, x + r, y);
    return [pts];
  }

  return [[x, y, x + w, y, x + w, y + h, x, y + h, x, y]];
}

function parsePolyline(attrs) {
  const points = (attrs.points || '').trim();
  if (!points) return [];
  const nums = points.split(/[\s,]+/).map(Number);
  if (nums.length < 4) return [];
  return [nums];
}

function parsePolygon(attrs) {
  const paths = parsePolyline(attrs);
  if (paths.length > 0 && paths[0].length >= 4) {
    // Close the polygon
    paths[0].push(paths[0][0], paths[0][1]);
  }
  return paths;
}

// ── SVG File Parser ──────────────────────────────────────────

function extractAttrs(tag) {
  const attrs = {};
  const re = /(\w[\w-]*)="([^"]*)"/g;
  let m;
  while ((m = re.exec(tag)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function parseSvgFile(svg) {
  const allPaths = [];

  // Match all shape elements
  const elementRe = /<(path|circle|ellipse|line|rect|polyline|polygon)\s+([^>]*?)\/?>/g;
  let m;
  while ((m = elementRe.exec(svg)) !== null) {
    const tag = m[1];
    const attrs = extractAttrs(m[0]);

    switch (tag) {
      case 'path':
        if (attrs.d) allPaths.push(...parseSvgPath(attrs.d));
        break;
      case 'circle':
        allPaths.push(...parseCircle(attrs));
        break;
      case 'ellipse':
        allPaths.push(...parseEllipse(attrs));
        break;
      case 'line':
        allPaths.push(...parseLine(attrs));
        break;
      case 'rect':
        allPaths.push(...parseRect(attrs));
        break;
      case 'polyline':
        allPaths.push(...parsePolyline(attrs));
        break;
      case 'polygon':
        allPaths.push(...parsePolygon(attrs));
        break;
    }
  }

  return allPaths;
}

// ── Name conversion ──────────────────────────────────────────

function toPascalCase(name) {
  const parts = name.replace(/\.svg$/, '').split(/[-_]/);
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    const s = parts[i];
    // Insert underscore between adjacent pure-digit segments to avoid collisions
    // e.g. "arrow-down-0-1" → "ArrowDown0_1" vs "arrow-down-01" → "ArrowDown01"
    if (i > 0 && /^\d+$/.test(s) && /^\d+$/.test(parts[i - 1])) {
      result += '_';
    }
    result += s.charAt(0).toUpperCase() + s.slice(1);
  }
  return result;
}

// ── Round coordinates to save bytes ──────────────────────────

function roundPath(path) {
  return path.map(n => Math.round(n * 100) / 100);
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  if (!existsSync(ICONS_DIR)) {
    console.error('lucide-static not found. Run: npm install --save-dev lucide-static');
    process.exit(1);
  }

  const files = readdirSync(ICONS_DIR).filter(f => f.endsWith('.svg')).sort();
  console.log(`Converting ${files.length} Lucide icons...`);

  const icons = [];
  const names = [];
  const seen = new Set();

  for (const file of files) {
    const svg = readFileSync(join(ICONS_DIR, file), 'utf-8');
    const paths = parseSvgFile(svg);

    if (paths.length === 0) {
      console.warn(`  SKIP: ${file} (no drawable elements)`);
      continue;
    }

    let name = toPascalCase(basename(file, '.svg'));
    if (seen.has(name)) {
      console.warn(`  COLLISION: ${file} → ${name} (already exists, appending _)`);
      name += '_';
    }
    seen.add(name);
    const rounded = paths.map(roundPath);
    icons.push({ name, paths: rounded });
    names.push(name);
  }

  // Generate TypeScript
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const lines = [
    '// Auto-generated by scripts/convert-icons.mjs — do not edit',
    '// Source: lucide-static SVG icons (https://lucide.dev)',
    '',
  ];

  for (const { name, paths } of icons) {
    const data = JSON.stringify(paths);
    lines.push(`export const ${name}: number[][] = ${data};`);
  }

  writeFileSync(join(OUT_DIR, 'icons.ts'), lines.join('\n') + '\n');

  // Generate names list
  const namesLines = [
    '// Auto-generated by scripts/convert-icons.mjs — do not edit',
    '',
    `export const iconNames: string[] = ${JSON.stringify(names)};`,
    '',
  ];
  writeFileSync(join(OUT_DIR, 'iconNames.ts'), namesLines.join('\n'));

  console.log(`Generated ${icons.length} icons → ${join(OUT_DIR, 'icons.ts')}`);
  console.log(`Generated name list → ${join(OUT_DIR, 'iconNames.ts')}`);
}

main();
