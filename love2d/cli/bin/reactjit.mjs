#!/usr/bin/env node

import { argv, exit } from 'node:process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initCommand } from '../commands/init.mjs';
import { devCommand } from '../commands/dev.mjs';
import { buildCommand } from '../commands/build.mjs';
import { lintCommand } from '../commands/lint.mjs';
import { screenshotCommand } from '../commands/screenshot.mjs';
import { updateCommand } from '../commands/update.mjs';
import { manifestCommand } from '../commands/manifest.mjs';
import { tslCommand } from '../commands/tsl.mjs';
import { diagnoseCommand } from '../commands/diagnose.mjs';
import { fontsCommand } from '../commands/fonts.mjs';
import { storybookCommand } from '../commands/storybook.mjs';
import { searchIndexCommand } from '../commands/search-index.mjs';
import { runConvert } from '../commands/convert.mjs';
import { migrateCommand } from '../commands/migrate.mjs';
import { migrateTkinterCommand } from '../commands/migrate-tkinter.mjs';
import { migrateSwiftUICommand } from '../commands/migrate-swiftui.mjs';
import { migrateBlessedCommand } from '../commands/migrate-blessed.mjs';
import { migratePyQt6Command } from '../commands/migrate-pyqt6.mjs';
import { migrateFlutterCommand } from '../commands/migrate-flutter.mjs';
import { testCommand } from '../commands/test.mjs';
import { overlayCommand } from '../commands/overlay.mjs';
import { classifyCommand } from '../commands/classify.mjs';
import { gradioCommand } from '../commands/gradio.mjs';

const [,, command, ...args] = argv;

// Version: stamped by esbuild define at dist build time, or read from package.json in dev.
function getVersion() {
  try {
    // Dist builds: esbuild replaces this with a string literal
    if (typeof __REACTJIT_VERSION__ !== 'undefined') return __REACTJIT_VERSION__;
  } catch {}
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version || 'unknown';
  } catch { return 'unknown'; }
}

const HELP = `
  reactjit (rjit) — CLI for ReactJIT

  Development:
    rjit dev                      Watch + HMR (Love2D)
    rjit build                    Dev build (Love2D)
    rjit overlay                  Overlay mode (transparent, always-on-top)
    rjit overlay --hotkey f9      Custom toggle hotkey (default: F6)
    rjit overlay --opacity 0.8    Window opacity (default: 0.9)
    rjit overlay --mode interactive  Start in interactive mode
    rjit overlay --attach ./game  Fullscreen overlay (LD_PRELOAD + shm)

  Production builds:
    rjit build linux              Self-extracting Linux binary (x64)
    rjit build macos              macOS bundle (Intel x64)
    rjit build macmseries         macOS bundle (Apple Silicon arm64)
    rjit build windows            Windows archive (x64)
    rjit build web                WASM bundle for browsers

  Apps:
    rjit storybook                Open the storybook

  Project management:
    rjit init <name>              Create a new project (interactive)
    rjit init <name> --all        Include all optional packages
    rjit init <name> --minimal    Core only, no optional packages
    rjit update                   Sync runtime files (lua/, lib/, reactjit/)
    rjit lint                     Check src/ for layout mistakes
    rjit manifest                 Generate or update manifest.json

  Fonts:
    rjit fonts                    List available font packs
    rjit fonts add <pack>         Add a font pack (e.g. cjk, arabic)
    rjit fonts remove <pack>      Remove a font pack

  Migration:
    rjit migrate <source-dir>     Convert React+Express app → ReactJIT project
    rjit migrate <dir> --dry-run  Show file classification without converting
    rjit migrate <dir> -o <out>   Custom output directory
    rjit migrate-tkinter <app.py> Convert Python Tkinter app → ReactJIT TSX
    rjit migrate-swiftui <app.swift> Convert SwiftUI app → ReactJIT TSX
    rjit migrate-blessed <app.js>   Convert Blessed terminal UI → ReactJIT TSX
    rjit migrate-pyqt6 <app.py>     Convert PyQt6/PySide6 app → ReactJIT TSX
    rjit migrate-flutter <app.dart>  Convert Flutter/Dart app → ReactJIT TSX

  Gradio:
    rjit gradio <url>             Render a running Gradio app natively
    rjit gradio <app.py>          Launch app.py headless + render natively
    rjit gradio config <url>      Dump /config as JSON
    rjit gradio components <url>  List components in the app

  Tools:
    rjit convert <file>           Convert HTML/React div-soup → ReactJIT
    rjit convert <file> -o out    Write converted output to file
    rjit tsl <file.tsl>           Transpile TypeScript-to-Lua (.tsl → .lua)
    rjit tsl --test               Run TSL transpiler test suite
    rjit test <spec.ts>           Run Love2D integration test (rjit build first)
    rjit test <spec.mjs>          Run node test (node --test)
    rjit test --all               Run all node tests in the monorepo
    rjit screenshot [--output]    Lint + build + headless screenshot
    rjit classify                 Extract repeated style patterns → .cls.ts
    rjit classify --output x.cls.ts  Write classifier sheet to file
    rjit classify --min 3         Minimum occurrences (default: 2)
    rjit classify --prefix App    Prefix names (default: auto-semantic)
    rjit classify --dir ./stories Scan specific directory
    rjit classify pick           Interactive pattern picker → name → migrate
    rjit classify add Name '{}'  Add one classifier (non-interactive) → migrate
    rjit classify rename Old New  Rename a classifier everywhere
    rjit classify migrate        Rewrite inline styles → classifier refs
    rjit classify migrate --partial  Also migrate superset matches (extras kept)
    rjit diagnose                 Find ghost nodes (in tree, not painting)
    rjit search-index             Index all <Text> nodes for cold AppSearch
    rjit help                     Show this help message

  Flags:
    --no-update     Skip auto-updating runtime files
    --debug         Enable inspector in dist builds
    --target <plat> Override platform (linux-x64, linux-arm64, macos-x64, macos-arm64, windows-x64)
`;

switch (command) {
  case 'init':
    await initCommand(args);
    break;
  case 'dev':
    await devCommand(args);
    break;
  case 'build':
    await buildCommand(args);
    break;
  case 'update':
    await updateCommand(args);
    break;
  case 'lint':
    await lintCommand(args);
    break;
  case 'screenshot':
    await screenshotCommand(args);
    break;
  case 'test':
    await testCommand(args);
    break;
  case 'overlay':
    await overlayCommand(args);
    break;
  case 'manifest':
    await manifestCommand(args);
    break;
  case 'tsl':
    await tslCommand(args);
    break;
  case 'diagnose':
    await diagnoseCommand(args);
    break;
  case 'fonts':
    await fontsCommand(args);
    break;
  case 'storybook':
    await storybookCommand(args);
    break;
  case 'search-index':
    await searchIndexCommand(args);
    break;
  case 'classify':
    await classifyCommand(args);
    break;
  case 'convert':
    runConvert(args);
    break;
  case 'migrate':
    await migrateCommand(args);
    break;
  case 'migrate-tkinter':
    migrateTkinterCommand(args);
    break;
  case 'migrate-swiftui':
    migrateSwiftUICommand(args);
    break;
  case 'migrate-blessed':
    migrateBlessedCommand(args);
    break;
  case 'migrate-pyqt6':
    migratePyQt6Command(args);
    break;
  case 'migrate-flutter':
    migrateFlutterCommand(args);
    break;
  case 'gradio':
    await gradioCommand(args);
    break;
  case '--version':
  case '-v':
    console.log(`reactjit ${getVersion()}`);
    break;
  case 'help':
  case '--help':
  case '-h':
  case undefined:
    console.log(HELP);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log(HELP);
    exit(1);
}
