/**
 * rjit gradio — Launch a Gradio app natively in ReactJIT.
 *
 * Usage:
 *   rjit gradio <url>              Connect to a running Gradio server
 *   rjit gradio <app.py>           Launch app.py headless + connect
 *   rjit gradio config <url>       Dump the parsed Gradio config as JSON
 *   rjit gradio components <url>   List component types in the app
 *
 * The command scaffolds a temporary ReactJIT project that renders the Gradio
 * app using <GradioApp url="..." />, then launches it with Love2D.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

// ── Helpers ─────────────────────────────────────────────

function isUrl(str) {
  return str.startsWith('http://') || str.startsWith('https://');
}

function isPythonFile(str) {
  return str.endsWith('.py') && existsSync(str);
}

async function fetchConfig(url) {
  const base = url.replace(/\/$/, '');
  const res = await fetch(`${base}/config`);
  if (!res.ok) throw new Error(`GET /config returned HTTP ${res.status}`);
  return res.json();
}

function waitForServer(url, timeoutMs = 30000) {
  const base = url.replace(/\/$/, '');
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        const res = await fetch(`${base}/config`);
        if (res.ok) return resolve();
      } catch {}
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Gradio server at ${url} did not start within ${timeoutMs / 1000}s`));
      }
      setTimeout(check, 500);
    };
    check();
  });
}

// ── Subcommands ─────────────────────────────────────────

async function configSubcommand(args) {
  const url = args[0];
  if (!url || !isUrl(url)) {
    console.error('Usage: rjit gradio config <url>');
    process.exit(1);
  }
  const config = await fetchConfig(url);
  console.log(JSON.stringify(config, null, 2));
}

async function componentsSubcommand(args) {
  const url = args[0];
  if (!url || !isUrl(url)) {
    console.error('Usage: rjit gradio components <url>');
    process.exit(1);
  }
  const config = await fetchConfig(url);
  console.log('\nGradio components:\n');
  for (const comp of config.components) {
    const label = comp.props?.label ?? '';
    const value = comp.props?.value ?? '';
    const info = label ? ` — "${label}"` : value ? ` — "${value}"` : '';
    console.log(`  [${comp.id}] ${comp.type}${info}`);
  }
  console.log(`\n  ${config.components.length} components, ${config.dependencies.length} dependencies\n`);
}

// ── Main: scaffold + launch ─────────────────────────────

async function launchGradioApp(target, args) {
  let serverUrl;
  let gradioProcess = null;

  if (isUrl(target)) {
    serverUrl = target;
  } else if (isPythonFile(target)) {
    // Launch the Python file headless, capture the port
    const port = 7860 + Math.floor(Math.random() * 100);
    serverUrl = `http://127.0.0.1:${port}`;

    console.log(`Launching ${basename(target)} on port ${port}...`);

    // Set env vars to make Gradio run headless on the chosen port
    gradioProcess = spawn('python3', [resolve(target)], {
      env: {
        ...process.env,
        GRADIO_SERVER_NAME: '127.0.0.1',
        GRADIO_SERVER_PORT: String(port),
        GRADIO_ANALYTICS_ENABLED: 'False',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    gradioProcess.stderr.on('data', (d) => {
      const line = d.toString();
      // Suppress Gradio's "Running on" banner — we show our own
      if (!line.includes('Running on')) process.stderr.write(line);
    });

    try {
      await waitForServer(serverUrl);
      console.log(`Gradio server ready at ${serverUrl}`);
    } catch (err) {
      gradioProcess.kill();
      console.error(err.message);
      process.exit(1);
    }
  } else {
    console.error(`Unknown target: ${target}`);
    console.error('Expected a URL (http://...) or a Python file (app.py)');
    process.exit(1);
  }

  // Scaffold a temporary ReactJIT project
  const tmpDir = join(tmpdir(), `rjit-gradio-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  // Write the app entry point
  const appTsx = `
import React from 'react';
import { GradioApp } from '@reactjit/gradio';

export default function App() {
  return <GradioApp url="${serverUrl}" />;
}
`;

  const mainTsx = `
import React from 'react';
import { createRoot } from '@reactjit/renderer';
import { ThemeProvider } from '@reactjit/theme';
import App from './App';

const root = createRoot();
root.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
`;

  mkdirSync(join(tmpDir, 'src'), { recursive: true });
  writeFileSync(join(tmpDir, 'src', 'App.tsx'), appTsx);
  writeFileSync(join(tmpDir, 'src', 'main.tsx'), mainTsx);
  writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
    name: 'gradio-viewer',
    version: '0.0.1',
    private: true,
  }, null, 2));

  console.log(`Scaffolded temp project at ${tmpDir}`);
  console.log(`Connecting to Gradio server at ${serverUrl}...`);

  // Build and launch with Love2D via dv or direct love
  try {
    // Use the CLI's own build pipeline
    execSync(`cd "${tmpDir}" && reactjit update && reactjit build`, {
      stdio: 'inherit',
      env: process.env,
    });

    // Launch via dv if available, otherwise direct
    const lovePath = join(tmpDir, 'love');
    execSync(`love "${lovePath}"`, { stdio: 'inherit' });
  } catch (err) {
    // Non-zero exit is normal when the window is closed
  } finally {
    // Cleanup
    if (gradioProcess) gradioProcess.kill();
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// ── Entry point ─────────────────────────────────────────

export async function gradioCommand(args) {
  const sub = args[0];

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(`
  rjit gradio — Render Gradio apps natively in ReactJIT

  Usage:
    rjit gradio <url>              Connect to a running Gradio server
    rjit gradio <app.py>           Launch app.py headless + render natively
    rjit gradio config <url>       Dump the Gradio /config response as JSON
    rjit gradio components <url>   List all components in the Gradio app
`);
    return;
  }

  switch (sub) {
    case 'config':
      await configSubcommand(args.slice(1));
      break;
    case 'components':
      await componentsSubcommand(args.slice(1));
      break;
    default:
      await launchGradioApp(sub, args.slice(1));
      break;
  }
}
