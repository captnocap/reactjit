import { existsSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');

// ── Color helpers ────────────────────────────────────────

import { bold, dim, cyan, green, yellow } from '../lib/log.mjs';

// ── Package registry ─────────────────────────────────────

const OPTIONAL_PACKAGES = [
  // ── UI & Layout ──────────────────────────────────────────
  {
    name: '@reactjit/theme',
    dir: 'theme',
    alias: '@reactjit/theme',
    flag: '--theme',
    description: 'Design tokens, theme switcher, dark/light support',
    importExample: "import { ThemeProvider, useTheme } from '@reactjit/theme';",
    default: true,
  },
  {
    name: '@reactjit/controls',
    dir: 'controls',
    alias: '@reactjit/controls',
    flag: '--controls',
    description: 'Hardware controls: knobs, faders, meters, pads, LEDs',
    importExample: "import { Knob, Fader, Meter } from '@reactjit/controls';",
    default: false,
  },

  // ── Navigation & State ───────────────────────────────────
  {
    name: '@reactjit/router',
    dir: 'router',
    alias: '@reactjit/router',
    flag: '--router',
    description: 'Navigation and URL routing',
    importExample: "import { RouterProvider, Route, Link } from '@reactjit/router';",
    default: true,
  },
  {
    name: '@reactjit/storage',
    dir: 'storage',
    alias: '@reactjit/storage',
    flag: '--storage',
    description: 'CRUD, schemas, data persistence',
    importExample: "import { useCRUD, createCRUD, z } from '@reactjit/storage';",
    default: true,
  },

  // ── Media & 3D ───────────────────────────────────────────
  {
    name: '@reactjit/3d',
    dir: '3d',
    alias: '@reactjit/3d',
    flag: '--3d',
    description: 'Declarative 3D scenes in JSX (Scene, Camera, Mesh)',
    importExample: "import { Scene, Camera, Mesh } from '@reactjit/3d';",
    default: false,
  },
  {
    name: '@reactjit/audio',
    dir: 'audio',
    alias: '@reactjit/audio',
    flag: '--audio',
    description: 'Audio engine: rack, MIDI, sampler, sequencer, recording',
    importExample: "import { useAudioRack, useMIDI } from '@reactjit/audio';",
    default: false,
  },
  {
    name: '@reactjit/media',
    dir: 'media',
    alias: '@reactjit/media',
    flag: '--media',
    description: 'File browser, archive (zip/tar), media library',
    importExample: "import { useMediaLibrary, useArchive } from '@reactjit/media';",
    default: false,
  },
  {
    name: '@reactjit/game',
    dir: 'game',
    alias: '@reactjit/game',
    flag: '--game',
    description: 'Game logic: entities, physics, input, genre templates',
    importExample: "import { useEntitySystem, useGameLoop } from '@reactjit/game';",
    default: false,
  },

  // ── Data & Networking ─────────────────────────────────────
  {
    name: '@reactjit/apis',
    dir: 'apis',
    alias: '@reactjit/apis',
    flag: '--apis',
    description: 'HTTP API hooks, service registry, bearer auth',
    importExample: "import { useAPI, useAPIMutation } from '@reactjit/apis';",
    default: false,
  },
  {
    name: '@reactjit/server',
    dir: 'server',
    alias: '@reactjit/server',
    flag: '--server',
    description: 'HTTP server (static files, API routes)',
    importExample: "import { useServer, useStaticServer } from '@reactjit/server';",
    default: false,
  },
  {
    name: '@reactjit/rss',
    dir: 'rss',
    alias: '@reactjit/rss',
    flag: '--rss',
    description: 'RSS/Atom feed fetching and parsing',
    importExample: "import { useFeed } from '@reactjit/rss';",
    default: false,
  },
  {
    name: '@reactjit/webhooks',
    dir: 'webhooks',
    alias: '@reactjit/webhooks',
    flag: '--webhooks',
    description: 'Outbound webhook posting and retry logic',
    importExample: "import { useWebhook } from '@reactjit/webhooks';",
    default: false,
  },
  {
    name: '@reactjit/geo',
    dir: 'geo',
    alias: '@reactjit/geo',
    flag: '--geo',
    description: 'Declarative maps: tiles, markers, offline support',
    importExample: "import { Map, TileLayer, Marker } from '@reactjit/geo';",
    default: false,
  },

  // ── Security & AI ────────────────────────────────────────
  {
    name: '@reactjit/crypto',
    dir: 'crypto',
    alias: '@reactjit/crypto',
    flag: '--crypto',
    description: 'Encryption, signing, key generation (libsodium + BLAKE3)',
    importExample: "import { useEncrypt, useSign, useKeyPair } from '@reactjit/crypto';",
    default: false,
  },
  {
    name: '@reactjit/ai',
    dir: 'ai',
    alias: '@reactjit/ai',
    flag: '--ai',
    description: 'LLM hooks (streaming chat, tool calling, key storage)',
    importExample: "import { useChat, useCompletion, AIProvider } from '@reactjit/ai';",
    default: false,
  },
];

// ── Supported migration frameworks ──────────────────────

const MIGRATION_FRAMEWORKS = [
  { name: 'Blessed (Node.js TUI)', command: 'migrate-blessed', extensions: ['.js', '.cjs', '.mjs'] },
  { name: 'Tkinter (Python GUI)', command: 'migrate-tkinter', extensions: ['.py'] },
  { name: 'SwiftUI (iOS/macOS)', command: 'migrate-swiftui', extensions: ['.swift'] },
  { name: 'PyQt6/PySide6 (Python GUI)', command: 'migrate-pyqt6', extensions: ['.py'] },
  { name: 'Flutter (Dart)', command: 'migrate-flutter', extensions: ['.dart'] },
  { name: 'HTML / React (Web)', command: 'convert', extensions: ['.html', '.htm', '.tsx', '.jsx'] },
];

// ── Interactive checkbox prompt ──────────────────────────

function promptPackages(packages) {
  return new Promise((resolve) => {
    // If not a TTY (piped input), skip interactive and use defaults
    if (!process.stdin.isTTY) {
      resolve(packages.map(p => p.default));
      return;
    }

    const selected = packages.map(p => p.default);
    let cursor = 0;

    function render() {
      // Move cursor up to overwrite previous render (except first time)
      if (render._drawn) {
        process.stdout.write(`\x1b[${packages.length}A`);
      }
      render._drawn = true;

      for (let i = 0; i < packages.length; i++) {
        const pkg = packages[i];
        const check = selected[i] ? green('[x]') : dim('[ ]');
        const pointer = i === cursor ? cyan('>') : ' ';
        const name = i === cursor ? bold(pkg.name) : pkg.name;
        const pad = ' '.repeat(Math.max(0, 26 - pkg.name.length));
        // Clear line then write
        process.stdout.write(`\x1b[2K  ${pointer} ${check} ${name}${pad}${dim(pkg.description)}\n`);
      }
    }

    console.log(`\n  ${bold('Optional packages')} ${dim('(arrows to move, space to toggle, enter to confirm)')}\n`);
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onData(key) {
      // Ctrl+C
      if (key === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        process.exit(0);
      }

      // Enter
      if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(selected);
        return;
      }

      // Space — toggle
      if (key === ' ') {
        selected[cursor] = !selected[cursor];
        render();
        return;
      }

      // Arrow keys (escape sequences)
      if (key === '\x1b[A' || key === 'k') {
        // Up
        cursor = (cursor - 1 + packages.length) % packages.length;
        render();
        return;
      }
      if (key === '\x1b[B' || key === 'j') {
        // Down
        cursor = (cursor + 1) % packages.length;
        render();
        return;
      }

      // 'a' — toggle all
      if (key === 'a') {
        const allSelected = selected.every(Boolean);
        for (let i = 0; i < selected.length; i++) selected[i] = !allSelected;
        render();
        return;
      }
    }

    process.stdin.on('data', onData);
  });
}

// ── Interactive single-choice prompt ─────────────────────

function promptChoice(question, choices) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(0);
      return;
    }

    let cursor = 0;

    function render() {
      if (render._drawn) {
        process.stdout.write(`\x1b[${choices.length}A`);
      }
      render._drawn = true;

      for (let i = 0; i < choices.length; i++) {
        const pointer = i === cursor ? cyan('>') : ' ';
        const label = i === cursor ? bold(choices[i].label) : choices[i].label;
        const desc = choices[i].description ? `  ${dim(choices[i].description)}` : '';
        process.stdout.write(`\x1b[2K  ${pointer} ${label}${desc}\n`);
      }
    }

    console.log(`\n  ${bold(question)}\n`);
    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function onData(key) {
      if (key === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        process.exit(0);
      }
      if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(cursor);
        return;
      }
      if (key === '\x1b[A' || key === 'k') {
        cursor = (cursor - 1 + choices.length) % choices.length;
        render();
      }
      if (key === '\x1b[B' || key === 'j') {
        cursor = (cursor + 1) % choices.length;
        render();
      }
    }

    process.stdin.on('data', onData);
  });
}

// ── Interactive text input prompt ────────────────────────

function promptText(question, defaultValue) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const prompt = defaultValue ? `  ${question} ${dim(`(${defaultValue})`)}: ` : `  ${question}: `;
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

// ── Parse flags for non-interactive mode ─────────────────

function parseFlags(args) {
  const flags = args.filter(a => a.startsWith('--'));

  if (flags.includes('--minimal')) {
    return OPTIONAL_PACKAGES.map(() => false);
  }

  if (flags.includes('--all')) {
    return OPTIONAL_PACKAGES.map(() => true);
  }

  // Check for individual package flags
  const hasSpecificFlags = OPTIONAL_PACKAGES.some(p => flags.includes(p.flag));
  if (hasSpecificFlags) {
    return OPTIONAL_PACKAGES.map(p => flags.includes(p.flag));
  }

  return null; // No flags — use interactive mode
}

// ── Generate tsconfig with selected paths ────────────────

function generateTsconfig(selectedPackages) {
  const paths = {
    '@reactjit/core': ['./reactjit/core/src'],
    '@reactjit/native': ['./reactjit/native/src'],
  };

  for (const pkg of selectedPackages) {
    paths[pkg.alias] = [`./reactjit/${pkg.dir}/src`];
  }

  return {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      paths,
    },
    include: ['src'],
  };
}

// ── Scaffold project (reusable core) ─────────────────────

/**
 * Create a new ReactJIT project on disk.
 *
 * @param {string} dest     Absolute path to the project directory (must not exist)
 * @param {object} opts
 * @param {string}   opts.name          Project name for package.json
 * @param {boolean[]} [opts.selections] Optional package selections (default: minimal = all false)
 * @param {string}   [opts.appTsx]      If provided, overwrite src/App.tsx with this content
 * @param {boolean}  [opts.skipInstall] Skip npm install (for testing)
 * @param {boolean}  [opts.quiet]       Suppress output
 * @returns {{ dest: string, name: string }}
 */
export function scaffoldProject(dest, opts = {}) {
  const { name, appTsx, skipInstall, quiet } = opts;
  const selections = opts.selections || OPTIONAL_PACKAGES.map(() => false);
  const selectedPackages = OPTIONAL_PACKAGES.filter((_, i) => selections[i]);
  const log = quiet ? () => {} : (...args) => console.log(...args);

  if (existsSync(dest)) {
    console.error(`  Directory "${name || dest}" already exists.`);
    process.exit(1);
  }

  // Create project directory
  mkdirSync(dest, { recursive: true });

  // Copy template files
  const templateDir = join(CLI_ROOT, 'template');
  cpSync(templateDir, dest, { recursive: true });

  // Copy lua runtime
  const runtimeLua = join(CLI_ROOT, 'runtime', 'lua');
  if (existsSync(runtimeLua)) {
    cpSync(runtimeLua, join(dest, 'lua'), { recursive: true });
    // In monorepo development, overlay critical source-of-truth runtime files.
    // Older cli/runtime snapshots can lag behind active source edits.
    const sourceLuaRoot = join(CLI_ROOT, '..', 'lua');
    for (const name of ['init.lua', 'bsod.lua', 'masks.lua', 'capabilities.lua']) {
      const src = join(sourceLuaRoot, name);
      if (existsSync(src)) {
        cpSync(src, join(dest, 'lua', name));
      }
    }
    // In monorepo development, always overlay source-of-truth lua/masks.
    // This keeps generated projects aligned with root runtime while iterating.
    const runtimeMasks = join(runtimeLua, 'masks');
    const sourceMasks = join(sourceLuaRoot, 'masks');
    if (existsSync(sourceMasks)) {
      cpSync(sourceMasks, join(dest, 'lua', 'masks'), { recursive: true });
    } else if (!existsSync(runtimeMasks)) {
      console.warn('  Warning: lua/masks/ not found in CLI runtime.');
    }
  } else {
    console.warn('  Warning: lua/ runtime not found in CLI. Run `make cli-setup` first.');
  }

  // Copy native lib
  const runtimeLib = join(CLI_ROOT, 'runtime', 'lib');
  if (existsSync(runtimeLib)) {
    cpSync(runtimeLib, join(dest, 'lib'), { recursive: true });
  } else {
    console.warn('  Warning: lib/ (libquickjs.so) not found in CLI. Run `make cli-setup` first.');
  }

  // Copy bundled binaries (tor)
  const runtimeBin = join(CLI_ROOT, 'runtime', 'bin');
  if (existsSync(runtimeBin)) {
    cpSync(runtimeBin, join(dest, 'bin'), { recursive: true });
  }

  // Copy framework source (shared + native — always included)
  const runtimePkgs = join(CLI_ROOT, 'runtime', 'reactjit');
  if (existsSync(runtimePkgs)) {
    const destPkgs = join(dest, 'reactjit');
    mkdirSync(destPkgs, { recursive: true });

    for (const dir of ['core', 'native']) {
      const src = join(runtimePkgs, dir);
      if (existsSync(src)) {
        cpSync(src, join(destPkgs, dir), { recursive: true });
      }
    }

    for (const pkg of selectedPackages) {
      const src = join(runtimePkgs, pkg.dir);
      if (existsSync(src)) {
        cpSync(src, join(destPkgs, pkg.dir), { recursive: true });
      }
    }
  } else {
    console.warn('  Warning: reactjit/ packages not found in CLI. Run `make cli-setup` first.');
  }

  // Generate tsconfig.json
  const tsconfig = generateTsconfig(selectedPackages);
  writeFileSync(join(dest, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');

  // Write package.json
  const pkg = {
    name: name || 'reactjit-app',
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'reactjit dev',
      build: 'reactjit build',
    },
    dependencies: {
      'react': '^18.3.0',
      'react-reconciler': '^0.29.0',
    },
    devDependencies: {
      'esbuild': '^0.24.0',
      '@types/react': '^18.3.0',
      'typescript': '^5.5.0',
    },
  };
  writeFileSync(join(dest, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  // Overwrite App.tsx if conversion output provided
  if (appTsx) {
    writeFileSync(join(dest, 'src', 'App.tsx'), appTsx, 'utf-8');
    // Migration scripts use `export default` — update main.tsx to match
    const mainTsx = join(dest, 'src', 'main.tsx');
    if (existsSync(mainTsx)) {
      const mainContent = readFileSync(mainTsx, 'utf-8');
      writeFileSync(mainTsx, mainContent
        .replace(/import\s*\{\s*App\s*\}\s*from/, "import App from")
      , 'utf-8');
    }
  }

  // Install dependencies
  if (!skipInstall) {
    log('  Installing dependencies...\n');
    try {
      execSync('npm install', { cwd: dest, stdio: quiet ? 'pipe' : 'inherit' });
    } catch {
      console.warn('\n  npm install failed. Run it manually in the project directory.');
    }
  }

  return { dest, name: name || 'reactjit-app', selectedPackages };
}

// ── Run a converter by command name ──────────────────────

async function runConverter(command, source) {
  if (command === 'migrate-blessed') {
    const { parseBlessedSource, buildIR } = await import('./migrate-blessed.mjs');
    const { assembleComponent } = await import('../lib/migration-core.mjs');
    const parsed = parseBlessedSource(source);
    const ir = buildIR(parsed);
    return assembleComponent(ir).code;
  }
  if (command === 'migrate-tkinter') {
    const { parseTkinterSource, generateReactJIT } = await import('./migrate-tkinter.mjs');
    return generateReactJIT(parseTkinterSource(source)).code;
  }
  if (command === 'migrate-swiftui') {
    const { parseSwiftUISource, generateReactJIT } = await import('./migrate-swiftui.mjs');
    return generateReactJIT(parseSwiftUISource(source)).code;
  }
  if (command === 'migrate-pyqt6') {
    const { parsePyQt6Source, generateReactJIT } = await import('./migrate-pyqt6.mjs');
    return generateReactJIT(parsePyQt6Source(source)).code;
  }
  if (command === 'migrate-flutter') {
    const { parseFlutterSource, generateReactJIT } = await import('./migrate-flutter.mjs');
    return generateReactJIT(parseFlutterSource(source)).code;
  }
  // convert (HTML/React)
  const { convertToReactJIT } = await import('./convert.mjs');
  const result = convertToReactJIT(source);
  return [result.imports, result.warningBlock, result.code].filter(Boolean).join('\n');
}

// ── Convert flow (interactive) ───────────────────────────

async function runConvertFlow(name) {
  // Pick framework
  const fwIdx = await promptChoice('What framework is the existing code written in?', [
    { label: 'Blessed (Node.js TUI)', description: '.js / .cjs / .mjs' },
    { label: 'Tkinter (Python GUI)', description: '.py' },
    { label: 'SwiftUI (iOS/macOS)', description: '.swift' },
    { label: 'PyQt6/PySide6 (Python GUI)', description: '.py' },
    { label: 'Flutter (Dart)', description: '.dart' },
    { label: 'HTML / React (Web)', description: '.html / .tsx / .jsx' },
  ]);

  const fw = MIGRATION_FRAMEWORKS[fwIdx];

  // Get input file
  const filePath = await promptText('Path to source file');
  if (!filePath) {
    console.error('  No file path provided.');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  if (!existsSync(absPath)) {
    console.error(`  File not found: ${absPath}`);
    process.exit(1);
  }

  const source = readFileSync(absPath, 'utf-8');

  // Run the appropriate converter
  let code;
  console.log(`\n  ${dim('Converting with')} ${bold(fw.command)}${dim('...')}`);

  code = await runConverter(fw.command, source);

  // Scaffold project with converted code
  const dest = join(process.cwd(), name);
  console.log(`\n  ${bold('Scaffolding project:')} ${cyan(name)}`);

  const { selectedPackages } = scaffoldProject(dest, {
    name,
    selections: OPTIONAL_PACKAGES.map(() => false),
    appTsx: code,
  });

  return { dest, name, selectedPackages };
}

// ── Init command ─────────────────────────────────────────

export async function initCommand(args) {
  const name = args.filter(a => !a.startsWith('--'))[0];
  if (!name) {
    console.error('Usage: reactjit init <project-name> [--all | --minimal | --convert | --router --storage --audio --game --3d --ai --apis --server --crypto --media --rss --webhooks --theme --controls --geo]');
    process.exit(1);
  }

  const dest = join(process.cwd(), name);

  // Non-interactive convert mode: rjit init myapp --convert path/to/file.js
  const convertIdx = args.indexOf('--convert');
  if (convertIdx !== -1) {
    const convertFile = args[convertIdx + 1];
    if (!convertFile || convertFile.startsWith('--')) {
      console.error('  --convert requires a file path. Usage: rjit init myapp --convert path/to/file.js');
      process.exit(1);
    }
    // Detect framework from extension
    const ext = '.' + convertFile.split('.').pop();
    const fw = MIGRATION_FRAMEWORKS.find(f => f.extensions.includes(ext));
    if (!fw) {
      console.error(`  Unknown file extension "${ext}". Supported: ${MIGRATION_FRAMEWORKS.flatMap(f => f.extensions).join(', ')}`);
      process.exit(1);
    }

    const absPath = resolve(convertFile);
    if (!existsSync(absPath)) {
      console.error(`  File not found: ${absPath}`);
      process.exit(1);
    }

    const source = readFileSync(absPath, 'utf-8');
    console.log(`\n  ${bold('Converting')} ${cyan(convertFile)} ${dim('with')} ${bold(fw.command)}`);
    const code = await runConverter(fw.command, source);

    console.log(`\n  ${bold('Scaffolding project:')} ${cyan(name)}`);
    scaffoldProject(dest, {
      name,
      selections: OPTIONAL_PACKAGES.map(() => false),
      appTsx: code,
    });

    console.log(`\n  ${green('Done!')} Converted ${convertFile} into a ReactJIT project.\n`);
    console.log(`  ${bold('Next steps:')}`);
    console.log(`    ${cyan('cd ' + name)}`);
    console.log(`    ${cyan('reactjit dev')}          ${dim('# Start esbuild watch (HMR)')}`);
    console.log(`    ${cyan('love .')}                  ${dim('# Run Love2D (in another terminal)')}`);
    console.log(`\n  Your converted code is in src/App.tsx\n`);
    return;
  }

  // Interactive mode — ask: new project or convert existing?
  const hasFlags = args.some(a => a.startsWith('--'));
  let mode = 'new';

  if (!hasFlags && process.stdin.isTTY) {
    console.log(`\n  ${bold('Creating ReactJIT project:')} ${cyan(name)}`);
    const choice = await promptChoice('How would you like to start?', [
      { label: 'New project', description: 'Start fresh with a blank canvas' },
      { label: 'Convert existing code', description: 'Migrate a Blessed, Tkinter, SwiftUI, or HTML app' },
    ]);
    mode = choice === 0 ? 'new' : 'convert';
  }

  if (mode === 'convert') {
    const { selectedPackages } = await runConvertFlow(name);
    console.log(`\n  ${green('Done!')} Your converted ReactJIT project is ready.\n`);
    console.log(`  ${bold('Next steps:')}`);
    console.log(`    ${cyan('cd ' + name)}`);
    console.log(`    ${cyan('reactjit dev')}          ${dim('# Start esbuild watch (HMR)')}`);
    console.log(`    ${cyan('love .')}                  ${dim('# Run Love2D (in another terminal)')}`);
    console.log(`\n  Your converted code is in src/App.tsx\n`);
    return;
  }

  // ── Standard new project flow ──────────────────────────

  if (!hasFlags) {
    console.log(`\n  ${bold('Creating ReactJIT project:')} ${cyan(name)}`);
  }

  if (existsSync(dest)) {
    console.error(`Directory "${name}" already exists.`);
    process.exit(1);
  }

  // Determine which optional packages to include
  let selections = parseFlags(args);
  if (selections === null) {
    // Interactive mode
    selections = await promptPackages(OPTIONAL_PACKAGES);
  } else {
    // Non-interactive — show what was selected
    console.log(`\n  ${bold('Creating ReactJIT project:')} ${cyan(name)}`);
    const modeLabel = args.includes('--minimal') ? 'minimal' : args.includes('--all') ? 'all' : 'custom';
    const count = selections.filter(Boolean).length;
    console.log(`  ${dim(`(${modeLabel} mode: ${count} optional package${count !== 1 ? 's' : ''})`)}\n`);
  }

  const { selectedPackages } = scaffoldProject(dest, { name, selections });

  // Show results
  console.log(`\n  ${green('Done!')} Your ReactJIT project is ready.\n`);

  console.log(`  ${bold('Included packages:')}`);
  console.log(`    ${dim("import { Box, Text, Pressable } from '@reactjit/core';")}`);
  for (const pkg of selectedPackages) {
    console.log(`    ${dim(pkg.importExample)}`);
  }

  console.log(`\n  ${bold('Next steps:')}`);
  console.log(`    ${cyan('cd ' + name)}`);
  console.log(`    ${cyan('reactjit dev')}          ${dim('# Start esbuild watch (HMR)')}`);
  console.log(`    ${cyan('love .')}                  ${dim('# Run Love2D (in another terminal)')}`);
  console.log(`\n  Edit src/App.tsx and watch it reload live!\n`);
}
