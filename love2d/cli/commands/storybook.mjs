import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function storybookCommand(args) {
  // 1. Dist mode: bundled storybook relative to CLI install dir
  //    <install>/cli/reactjit.mjs → <install>/apps/storybook.love + <install>/apps/love
  const installDir = resolve(__dirname, '..', '..');
  const storybookLove = join(installDir, 'apps', 'storybook.love');
  const loveBin = join(installDir, 'apps', 'love');

  if (existsSync(storybookLove) && existsSync(loveBin)) {
    console.log('Opening storybook...');
    execSync(`"${loveBin}" "${storybookLove}"`, { stdio: 'inherit' });
    return;
  }

  // 2. Monorepo dev mode: run from source
  const monoRoot = resolve(__dirname, '..', '..');
  const storybookLoveDir = join(monoRoot, 'storybook', 'love');

  if (existsSync(join(storybookLoveDir, 'main.lua'))) {
    console.log('Opening storybook (dev mode)...');
    execSync('love .', { cwd: storybookLoveDir, stdio: 'inherit' });
    return;
  }

  console.error('Could not find storybook. Run from the monorepo or use a full install.');
  process.exit(1);
}
