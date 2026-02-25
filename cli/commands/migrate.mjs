/**
 * migrate.mjs — One-shot React+Express → ReactJIT migration
 *
 * Takes a React project (with optional Express backend) and converts it to
 * a ReactJIT project in a single pass:
 *
 *   1. UI files (.tsx/.jsx with JSX)  → convert.mjs → ReactJIT Box/Text/Image components
 *   2. Pure logic (.ts, no Node APIs) → TSL transpiler → .lua (runs in LuaJIT)
 *   3. Express routes                 → @reactjit/server useServer() hooks
 *   4. Static assets                  → copied directly
 *
 * Usage:
 *   rjit migrate /path/to/react-app                    # migrate into ./migrated-<name>/
 *   rjit migrate /path/to/react-app --output ./my-app  # custom output dir
 *   rjit migrate /path/to/react-app --dry-run           # show what would happen
 *
 * The migration is intentionally imperfect — it gets you 80-90% of the way there
 * and generates a MIGRATION.md report with every TODO that needs manual attention.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs';
import { join, basename, dirname, extname, relative, resolve } from 'node:path';
import { convertToReactJIT } from './convert.mjs';
import { transpile, TSLError } from '../lib/tsl.mjs';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FILE CLASSIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Node/Express imports that make a file non-TSL-compatible
const NODE_API_PATTERNS = [
  /\bimport\b.*\bfrom\s+['"]express/,
  /\bimport\b.*\bfrom\s+['"]node:/,
  /\bimport\b.*\bfrom\s+['"]fs\b/,
  /\bimport\b.*\bfrom\s+['"]path\b/,
  /\bimport\b.*\bfrom\s+['"]http\b/,
  /\bimport\b.*\bfrom\s+['"]https\b/,
  /\bimport\b.*\bfrom\s+['"]net\b/,
  /\bimport\b.*\bfrom\s+['"]child_process/,
  /\bimport\b.*\bfrom\s+['"]crypto\b/,
  /\bimport\b.*\bfrom\s+['"]stream\b/,
  /\bimport\b.*\bfrom\s+['"]url\b/,
  /\bimport\b.*\bfrom\s+['"]os\b/,
  /\bimport\b.*\bfrom\s+['"]process\b/,
  /\brequire\s*\(\s*['"]express/,
  /\brequire\s*\(\s*['"]fs/,
];

// Patterns that indicate async/class usage (TSL can't handle these)
const TSL_BLOCKERS = [
  /\basync\s+function\b/,
  /\basync\s*\(/,
  /\bawait\s+/,
  /\bclass\s+\w+/,
  /\bnew\s+\w+/,
  /\btry\s*\{/,
  /\bcatch\s*\(/,
  /\bthrow\s+/,
];

// Express route patterns
const EXPRESS_ROUTE_PATTERNS = [
  /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"](.*?)['"]\s*,/g,
  /Router\s*\(\s*\)/,
];

// JSX detection
const JSX_PATTERN = /<\w+[\s>]|<\w+\//;

/**
 * Classify a source file into categories:
 *  - 'ui'     → React JSX file, run through convert.mjs
 *  - 'logic'  → Pure TS logic, run through TSL transpiler
 *  - 'server' → Express/Node server code, generate useServer stubs
 *  - 'mixed'  → Has Node APIs + logic, needs manual split
 *  - 'asset'  → Non-code file, copy directly
 *  - 'skip'   → node_modules, lock files, etc.
 */
function classifyFile(filePath, content) {
  const ext = extname(filePath);
  const base = basename(filePath);
  const dir = dirname(filePath);

  // Skip
  if (dir.includes('node_modules')) return 'skip';
  if (dir.includes('.git')) return 'skip';
  if (base === 'package-lock.json' || base === 'yarn.lock' || base === 'pnpm-lock.yaml') return 'skip';
  if (base === '.gitignore' || base === '.eslintrc' || base === '.prettierrc') return 'skip';
  if (base.endsWith('.config.js') || base.endsWith('.config.ts') || base.endsWith('.config.mjs')) return 'skip';
  if (base === 'tsconfig.json') return 'skip';

  // Non-code assets
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp3', '.mp4', '.wav', '.ogg',
       '.woff', '.woff2', '.ttf', '.eot', '.css', '.html'].includes(ext)) return 'asset';

  // Package.json → we'll generate a new one
  if (base === 'package.json') return 'skip';

  // Only process TS/JS/JSX files
  if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return 'asset';

  // Check for JSX (UI files)
  if ((ext === '.tsx' || ext === '.jsx') && JSX_PATTERN.test(content)) {
    return 'ui';
  }

  // Check for Express/Node imports (server files)
  const hasNodeAPIs = NODE_API_PATTERNS.some(p => p.test(content));
  const hasExpressRoutes = EXPRESS_ROUTE_PATTERNS.some(p => p.test(content));

  if (hasExpressRoutes || (hasNodeAPIs && (dir.includes('server') || dir.includes('api') || dir.includes('routes')))) {
    return 'server';
  }

  if (hasNodeAPIs) return 'mixed';

  // Check for TSL blockers
  const hasTSLBlockers = TSL_BLOCKERS.some(p => p.test(content));
  if (hasTSLBlockers) return 'mixed';

  // Pure TS logic — TSL candidate
  return 'logic';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPRESS ROUTE EXTRACTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Extract Express route definitions from a server file.
 * Returns an array of { method, path, handlerSource, mountPrefix }
 */
function extractExpressRoutes(content, filePath) {
  const routes = [];

  // Find app.use('/prefix', router) mount points
  const mountPattern = /app\.use\s*\(\s*['"](\/[^'"]*)['"]\s*,\s*(\w+)/g;
  const mounts = {};
  let mountMatch;
  while ((mountMatch = mountPattern.exec(content)) !== null) {
    mounts[mountMatch[2]] = mountMatch[1];
  }

  // Find route definitions: router.get('/path', handler) or app.get('/path', handler)
  const routePattern = /(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\s*,\s*((?:\([^)]*\)\s*=>|function\s*\([^)]*\))\s*\{)/g;
  let routeMatch;
  while ((routeMatch = routePattern.exec(content)) !== null) {
    const method = routeMatch[1].toUpperCase();
    const path = routeMatch[2];

    // Extract handler body (find matching closing brace)
    const startIdx = routeMatch.index + routeMatch[0].length;
    let depth = 1;
    let idx = startIdx;
    while (idx < content.length && depth > 0) {
      if (content[idx] === '{') depth++;
      else if (content[idx] === '}') depth--;
      idx++;
    }
    const handlerBody = content.slice(startIdx, idx - 1).trim();

    routes.push({ method, path, handlerBody, file: filePath });
  }

  return routes;
}

/**
 * Convert extracted Express routes to a useServer configuration.
 */
function generateServerHook(allRoutes, mountPrefixes, staticDirs) {
  let code = `import { useServer } from '@reactjit/server';\n\n`;

  // Group routes by mount prefix for readability
  const routeConfigs = [];

  for (const route of allRoutes) {
    // Find mount prefix for this file
    const prefix = mountPrefixes[route.file] || '';
    const fullPath = prefix + route.path;

    routeConfigs.push({
      method: route.method,
      path: fullPath,
      handlerBody: route.handlerBody,
    });
  }

  code += `// Server hook — converted from Express routes\n`;
  code += `export function useAppServer(port: number) {\n`;
  code += `  return useServer({\n`;
  code += `    port,\n`;
  code += `    routes: [\n`;

  for (const r of routeConfigs) {
    code += `      {\n`;
    code += `        method: '${r.method}',\n`;
    code += `        path: '${r.path}',\n`;
    code += `        handler: (req) => {\n`;
    code += `          ${convertHandlerBody(r.handlerBody)}\n`;
    code += `        },\n`;
    code += `      },\n`;
  }

  code += `    ],\n`;

  if (staticDirs.length > 0) {
    code += `    static: [\n`;
    for (const dir of staticDirs) {
      code += `      { path: '/', root: '${dir}' },\n`;
    }
    code += `    ],\n`;
  }

  code += `  });\n`;
  code += `}\n`;

  return code;
}

/**
 * Convert Express handler body to @reactjit/server handler.
 * Express: res.json(data), res.status(N).json(data), res.send()
 * ReactJIT: return { status, headers, body }
 */
function convertHandlerBody(body) {
  let converted = body;

  // req.params.X → req.params.X (same!)
  // req.query.X → req.query.X (same!)
  // req.body → req.body (need JSON.parse)

  // res.json(data) → return { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
  converted = converted.replace(
    /res\.json\(([^)]+)\)/g,
    "return { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify($1) }"
  );

  // res.status(N).json(data) → return { status: N, ... }
  converted = converted.replace(
    /res\.status\((\d+)\)\.json\(([^)]+)\)/g,
    "return { status: $1, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify($2) }"
  );

  // res.status(N).send(data) → return { status: N, body: data }
  converted = converted.replace(
    /res\.status\((\d+)\)\.send\(([^)]*)\)/g,
    "return { status: $1, body: $2 || '' }"
  );

  // res.send(data) → return { status: 200, body: data }
  converted = converted.replace(
    /res\.send\(([^)]*)\)/g,
    "return { status: 200, body: $1 || '' }"
  );

  // return res.status(N).json(...) → just the return
  converted = converted.replace(/return\s+return\s+/g, 'return ');

  // req.body needs JSON.parse (Express auto-parses with express.json())
  if (converted.includes('req.body') && !converted.includes('JSON.parse(req.body)')) {
    converted = `const body = JSON.parse(req.body);\n          ` +
      converted.replace(/req\.body/g, 'body');
  }

  // parseInt(req.params.X) stays the same
  // process.uptime() → os.clock() (approximate)
  converted = converted.replace(/process\.uptime\(\)/g, '0 /* TODO: no process.uptime in ReactJIT */');

  return converted;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TSL PREPARATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Prepare a .ts file for TSL transpilation:
 * - Strip type-only imports
 * - Rewrite import paths to lua module paths
 * - Replace Date.now() with os.clock(), etc.
 * - Fix 0-indexed array access to 1-indexed
 */
function prepareForTSL(content, filePath) {
  let code = content;
  const warnings = [];

  // Strip React imports (not needed in Lua)
  code = code.replace(/^import\s+.*\bfrom\s+['"]react['"];?\s*$/gm, '');

  // Strip type-only imports
  code = code.replace(/^import\s+type\s+.*$/gm, '');

  // Rewrite relative imports to lua module paths
  // import { foo } from '../utils/validation' → import { foo } from 'lua.validation'
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/?([^'"]+)['"]/g,
    (match, imports, path) => {
      const moduleName = basename(path).replace(/\.(ts|js|tsx|jsx)$/, '');
      return `import {${imports}} from "lua.${moduleName}"`;
    }
  );
  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\/([^'"]+)['"]/g,
    (match, imports, path) => {
      const moduleName = basename(path).replace(/\.(ts|js|tsx|jsx)$/, '');
      return `import {${imports}} from "lua.${moduleName}"`;
    }
  );

  // Date.now() → os.time() * 1000
  if (code.includes('Date.now()')) {
    code = code.replace(/Date\.now\(\)/g, 'os.time() * 1000');
    warnings.push('Date.now() → os.time() * 1000 (second precision, not millisecond)');
  }

  // JSON.stringify → needs manual implementation or capability
  if (code.includes('JSON.stringify') || code.includes('JSON.parse')) {
    warnings.push('JSON.stringify/parse used — add cjson require in Lua, or use bridge');
  }

  // console.log → print (TSL handles this already)

  // lastIndexOf → needs stdlib addition or manual rewrite
  if (code.includes('.lastIndexOf(')) {
    warnings.push('.lastIndexOf() not in TSL stdlib — needs manual Lua implementation');
  }

  return { code, warnings };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN MIGRATION ENGINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function walkDir(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') continue;
      files.push(...walkDir(full, base));
    } else {
      files.push({ path: full, relative: relative(base, full) });
    }
  }
  return files;
}

export async function migrateCommand(args) {
  const srcDir = args.find(a => !a.startsWith('-'));
  const dryRun = args.includes('--dry-run');
  const outputIdx = args.indexOf('--output');
  const helpMode = args.includes('--help') || args.includes('-h');

  if (helpMode || !srcDir) {
    console.log(`
  rjit migrate — Convert a React+Express project to ReactJIT

  Usage:
    rjit migrate <source-dir>                 Migrate into ./migrated-<name>/
    rjit migrate <source-dir> --output ./app  Custom output directory
    rjit migrate <source-dir> --dry-run       Show classification only

  What happens:
    1. Scans all source files and classifies them:
       - UI (.tsx/.jsx with JSX)     → JSX converter → ReactJIT components
       - Logic (.ts, pure functions) → TSL transpiler → .lua files for LuaJIT
       - Server (Express routes)     → @reactjit/server useServer() hooks
       - Assets (images, fonts)      → copied directly

    2. Generates a complete ReactJIT project with:
       - src/App.tsx (converted UI)
       - src/tsl/*.tsl (logic files ready for TSL)
       - src/server.tsx (useServer hook with converted routes)
       - lua/*.lua (transpiled logic modules)
       - MIGRATION.md (TODO list for manual fixes)
`);
    return;
  }

  const resolvedSrc = resolve(srcDir);
  if (!existsSync(resolvedSrc)) {
    console.error(`Source directory not found: ${resolvedSrc}`);
    process.exit(1);
  }

  const projectName = basename(resolvedSrc);
  const outputDir = outputIdx !== -1 ? resolve(args[outputIdx + 1]) : resolve(`migrated-${projectName}`);

  console.log(`\n  Migrating: ${resolvedSrc}`);
  console.log(`  Output:    ${outputDir}\n`);

  // ── Phase 1: Scan and classify ──────────────────
  console.log('  Phase 1: Scanning files...');
  const files = walkDir(resolvedSrc);
  const classified = { ui: [], logic: [], server: [], mixed: [], asset: [], skip: [] };

  for (const file of files) {
    const content = readFileSync(file.path, 'utf-8');
    const category = classifyFile(file.relative, content);
    classified[category].push({ ...file, content });
  }

  console.log(`    UI files:     ${classified.ui.length}`);
  console.log(`    Logic files:  ${classified.logic.length}`);
  console.log(`    Server files: ${classified.server.length}`);
  console.log(`    Mixed files:  ${classified.mixed.length}`);
  console.log(`    Assets:       ${classified.asset.length}`);
  console.log(`    Skipped:      ${classified.skip.length}`);

  if (dryRun) {
    console.log('\n  File classification:');
    for (const [cat, files] of Object.entries(classified)) {
      if (cat === 'skip' || files.length === 0) continue;
      console.log(`\n  [${cat.toUpperCase()}]`);
      for (const f of files) {
        console.log(`    ${f.relative}`);
      }
    }
    console.log('\n  Dry run — no files written.');
    return;
  }

  // ── Phase 2: Create output structure ────────────
  console.log('\n  Phase 2: Creating project structure...');
  const dirs = ['src', 'src/components', 'src/tsl', 'lua', 'assets'];
  for (const d of dirs) {
    mkdirSync(join(outputDir, d), { recursive: true });
  }

  const report = {
    converted: [],
    transpiled: [],
    serverRoutes: [],
    warnings: [],
    todos: [],
  };

  // ── Phase 3: Convert UI files ───────────────────
  console.log('  Phase 3: Converting UI files...');
  for (const file of classified.ui) {
    const result = convertToReactJIT(file.content);

    // Rewrite imports from relative utils to TSL lua modules
    let code = result.code;
    code = code.replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]\.\.?\/?[^'"]*utils\/([^'"]+)['"]/g,
      (match, imports, name) => {
        const moduleName = name.replace(/\.(ts|js)$/, '');
        return `// TODO: import {${imports.trim()}} — these are now Lua modules, call via bridge or inline`;
      }
    );

    const outName = file.relative.replace(/^src\//, '');
    const outPath = join(outputDir, 'src', outName);
    mkdirSync(dirname(outPath), { recursive: true });

    const fullOutput = [
      result.imports,
      result.warningBlock,
      code,
    ].filter(Boolean).join('\n');

    writeFileSync(outPath, fullOutput, 'utf-8');
    report.converted.push({ file: outName, warnings: result.warnings.length });
    report.warnings.push(...result.warnings.map(w => `[${outName}] ${w}`));
    console.log(`    ${outName} (${result.warnings.length} warnings)`);
  }

  // ── Phase 4: Transpile logic files via TSL ──────
  console.log('  Phase 4: Transpiling logic to Lua...');
  for (const file of classified.logic) {
    const { code: prepared, warnings: prepWarnings } = prepareForTSL(file.content, file.path);
    report.warnings.push(...prepWarnings.map(w => `[${file.relative}] ${w}`));

    // Save as .tsl in src/tsl/
    const tslName = basename(file.relative).replace(/\.(ts|js)$/, '.tsl');
    const tslPath = join(outputDir, 'src', 'tsl', tslName);
    writeFileSync(tslPath, prepared, 'utf-8');

    // Attempt TSL transpilation
    const luaName = tslName.replace('.tsl', '.lua');
    try {
      const lua = transpile(prepared, tslName);
      writeFileSync(join(outputDir, 'lua', luaName), lua, 'utf-8');
      report.transpiled.push({ tsl: tslName, lua: luaName, success: true });
      console.log(`    ${tslName} → ${luaName}`);
    } catch (err) {
      report.transpiled.push({ tsl: tslName, lua: null, success: false, error: err.message });
      report.todos.push(`[TSL ERROR] ${tslName}: ${err.message} — needs manual conversion`);
      console.log(`    ${tslName} FAILED: ${err.message}`);
    }
  }

  // ── Phase 5: Convert Express routes ─────────────
  console.log('  Phase 5: Converting Express routes...');
  const allRoutes = [];
  const mountPrefixes = {};
  const staticDirs = [];

  for (const file of classified.server) {
    const routes = extractExpressRoutes(file.content, file.relative);
    allRoutes.push(...routes);
    report.serverRoutes.push(...routes.map(r => `${r.method} ${r.path} (from ${file.relative})`));

    // Check for app.use('/prefix', router) in main server file
    const mountPattern = /app\.use\s*\(\s*['"](\/[^'"]*)['"]\s*,\s*(\w+)/g;
    let m;
    while ((m = mountPattern.exec(file.content)) !== null) {
      // Try to figure out which file the router comes from
      const routerName = m[2];
      const importPattern = new RegExp(`import\\s*\\{\\s*${routerName}\\s*\\}\\s*from\\s*['"]([^'"]+)['"]`);
      const importMatch = file.content.match(importPattern);
      if (importMatch) {
        const routerFile = importMatch[1].replace(/^\.\//, '').replace(/^\.\.\//, '');
        mountPrefixes[routerFile] = m[1];
        // Also look for routes/* files
        for (const sf of classified.server) {
          if (sf.relative.includes(routerFile.replace(/\.(ts|js)$/, ''))) {
            mountPrefixes[sf.relative] = m[1];
          }
        }
      }
    }

    // Check for express.static()
    const staticMatch = file.content.match(/express\.static\s*\(\s*['"]([^'"]+)['"]\s*\)/);
    if (staticMatch) {
      staticDirs.push(staticMatch[1]);
    }
  }

  if (allRoutes.length > 0) {
    const serverCode = generateServerHook(allRoutes, mountPrefixes, staticDirs);
    writeFileSync(join(outputDir, 'src', 'server.tsx'), serverCode, 'utf-8');
    console.log(`    Generated src/server.tsx with ${allRoutes.length} routes`);
  }

  // ── Phase 6: Handle mixed files ─────────────────
  for (const file of classified.mixed) {
    report.todos.push(`[MANUAL] ${file.relative} — has Node APIs + async/class patterns, needs manual rewrite`);
    // Copy as-is with a .bak extension so user can reference it
    const outPath = join(outputDir, 'src', '_original', file.relative);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, file.content, 'utf-8');
  }

  // ── Phase 7: Copy assets ────────────────────────
  console.log('  Phase 6: Copying assets...');
  for (const file of classified.asset) {
    const outPath = join(outputDir, 'assets', file.relative);
    mkdirSync(dirname(outPath), { recursive: true });
    copyFileSync(file.path, outPath);
  }
  if (classified.asset.length > 0) {
    console.log(`    ${classified.asset.length} assets copied`);
  }

  // ── Phase 8: Generate MIGRATION.md report ───────
  console.log('  Phase 7: Generating migration report...');

  let md = `# Migration Report: ${projectName}\n\n`;
  md += `Source: \`${resolvedSrc}\`\n`;
  md += `Generated: ${new Date().toISOString().split('T')[0]}\n\n`;

  md += `## Summary\n\n`;
  md += `| Category | Count | Status |\n`;
  md += `|----------|-------|--------|\n`;
  md += `| UI files converted | ${report.converted.length} | Done |\n`;
  md += `| Logic files → Lua | ${report.transpiled.filter(t => t.success).length} | Done |\n`;
  md += `| TSL failures | ${report.transpiled.filter(t => !t.success).length} | Needs manual fix |\n`;
  md += `| Server routes | ${report.serverRoutes.length} | Generated (verify) |\n`;
  md += `| Mixed files | ${classified.mixed.length} | Needs manual rewrite |\n`;
  md += `| Assets copied | ${classified.asset.length} | Done |\n\n`;

  if (report.serverRoutes.length > 0) {
    md += `## Server Routes (converted to useServer)\n\n`;
    for (const r of report.serverRoutes) {
      md += `- \`${r}\`\n`;
    }
    md += `\n`;
    md += `The Express server has been converted to \`src/server.tsx\` using \`@reactjit/server\`'s \`useServer()\` hook.\n`;
    md += `Review each route handler — the response format changed from \`res.json()\` to \`return { status, headers, body }\`.\n\n`;
  }

  if (report.transpiled.some(t => t.success)) {
    md += `## Lua Modules (transpiled from TypeScript)\n\n`;
    md += `These pure logic files were converted to Lua and run directly in LuaJIT:\n\n`;
    for (const t of report.transpiled.filter(t => t.success)) {
      md += `- \`src/tsl/${t.tsl}\` → \`lua/${t.lua}\`\n`;
    }
    md += `\nTo re-transpile after edits: \`rjit tsl src/tsl/<file>.tsl -o lua/<file>.lua\`\n\n`;
  }

  if (report.todos.length > 0) {
    md += `## TODO (manual attention required)\n\n`;
    for (const todo of report.todos) {
      md += `- ${todo}\n`;
    }
    md += `\n`;
  }

  if (report.warnings.length > 0) {
    md += `## Conversion Warnings\n\n`;
    const uniqueWarnings = [...new Set(report.warnings)];
    for (const w of uniqueWarnings.slice(0, 50)) {
      md += `- ${w}\n`;
    }
    if (uniqueWarnings.length > 50) {
      md += `- ... and ${uniqueWarnings.length - 50} more\n`;
    }
    md += `\n`;
  }

  md += `## Next Steps\n\n`;
  md += `1. Review \`src/server.tsx\` — verify route handlers return correct \`{ status, headers, body }\`\n`;
  md += `2. Fix any TSL transpilation failures in \`src/tsl/\`\n`;
  md += `3. Check \`src/_original/\` for mixed files that need manual rewrite\n`;
  md += `4. Replace \`fetch('/api/...')\` calls in UI with direct state management or bridge calls\n`;
  md += `5. Run \`rjit lint\` to catch remaining layout issues\n`;
  md += `6. Run \`rjit build\` to verify the build succeeds\n`;
  md += `7. Use \`useThemeColors()\` to replace hardcoded color values with theme tokens\n`;

  writeFileSync(join(outputDir, 'MIGRATION.md'), md, 'utf-8');

  // ── Done ────────────────────────────────────────
  console.log(`\n  Migration complete → ${outputDir}`);
  console.log(`    ${report.converted.length} UI files converted`);
  console.log(`    ${report.transpiled.filter(t => t.success).length} logic files → Lua`);
  console.log(`    ${report.transpiled.filter(t => !t.success).length} TSL failures (see MIGRATION.md)`);
  console.log(`    ${allRoutes.length} Express routes → useServer()`);
  console.log(`    ${report.todos.length} items need manual attention`);
  console.log(`\n  Read MIGRATION.md for the full report.\n`);
}
