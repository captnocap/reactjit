#!/usr/bin/env node

import { argv, exit } from 'node:process';
import { initCommand } from '../commands/init.mjs';
import { devCommand } from '../commands/dev.mjs';
import { buildCommand } from '../commands/build.mjs';
import { lintCommand } from '../commands/lint.mjs';
import { screenshotCommand } from '../commands/screenshot.mjs';
import { updateCommand } from '../commands/update.mjs';
import { manifestCommand } from '../commands/manifest.mjs';
import { tslCommand } from '../commands/tsl.mjs';
import { diagnoseCommand } from '../commands/diagnose.mjs';

const [,, command, ...args] = argv;

const HELP = `
  reactjit (rjit) — CLI for ReactJIT

  Development:
    rjit dev                      Watch + HMR (SDL2, default)
    rjit dev love                 Watch + HMR (Love2D)
    rjit build                    Dev build (SDL2, default)

  Production builds:
    rjit build linux              Self-extracting Linux binary (x64)
    rjit build macos              macOS bundle (Intel x64)
    rjit build macmseries         macOS bundle (Apple Silicon arm64)
    rjit build windows            Windows archive (x64)
    rjit build dist:love          Self-extracting Linux binary (Love2D + glibc)

  Project management:
    rjit init <name>              Create a new project (interactive)
    rjit init <name> --all        Include all optional packages
    rjit init <name> --minimal    Core only, no optional packages
    rjit update                   Sync runtime files (lua/, lib/, reactjit/)
    rjit lint                     Check src/ for layout mistakes
    rjit manifest                 Generate or update manifest.json

  Tools:
    rjit tsl <file.tsl>           Transpile TypeScript-to-Lua (.tsl → .lua)
    rjit tsl --test               Run TSL transpiler test suite
    rjit screenshot [--output]    Lint + build + headless screenshot
    rjit diagnose                 Find ghost nodes (in tree, not painting)
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
  case 'manifest':
    await manifestCommand(args);
    break;
  case 'tsl':
    await tslCommand(args);
    break;
  case 'diagnose':
    await diagnoseCommand(args);
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
