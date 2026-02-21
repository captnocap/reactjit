import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLint, runBundleChecks } from './lint.mjs';
import { updateCommand } from './update.mjs';
import { TARGETS, TARGET_NAMES, esbuildArgs, esbuildDistArgs } from '../targets.mjs';
import { getEsbuildAliases } from '../lib/aliases.mjs';
import { transpile } from '../lib/tsl.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_ROOT = join(__dirname, '..');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.webm', '.mov', '.m4v', '.flv', '.wmv']);

/** Check if ffmpeg is available on the system. */
function hasFFmpeg() {
  try {
    execSync('which ffmpeg', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scan directories for video files and convert non-.ogv files to Theora format.
 * Places .ogv files alongside originals (same name, .ogv extension).
 * Skips if .ogv already exists and is newer than the source.
 */
function convertVideos(dirs) {
  if (!hasFFmpeg()) {
    return { converted: 0, skipped: 0, noFFmpeg: true };
  }

  let converted = 0;
  let skipped = 0;

  function scanDir(dir) {
    if (!existsSync(dir)) return;
    let entries;
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stat;
      try { stat = statSync(fullPath); } catch { continue; }

      if (stat.isDirectory()) {
        // Skip node_modules, dist, .git, __video_cache
        if (!['node_modules', 'dist', '.git', '__video_cache'].includes(entry)) {
          scanDir(fullPath);
        }
        continue;
      }

      const ext = extname(entry).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) continue;

      // Check if .ogv sibling already exists and is up-to-date
      const ogvPath = fullPath.replace(/\.[^.]+$/, '.ogv');
      if (existsSync(ogvPath)) {
        try {
          const ogvStat = statSync(ogvPath);
          if (ogvStat.mtimeMs >= stat.mtimeMs) {
            skipped++;
            continue;
          }
        } catch { /* re-convert */ }
      }

      console.log(`  [video] Converting ${entry} → ${basename(ogvPath)}...`);
      try {
        execSync(
          `ffmpeg -y -i "${fullPath}" -c:v libtheora -q:v 7 -c:a libvorbis -q:a 4 "${ogvPath}"`,
          { stdio: 'pipe' }
        );
        converted++;
      } catch (err) {
        console.error(`  [video] Failed to convert ${entry}: ${err.message}`);
      }
    }
  }

  for (const dir of dirs) {
    scanDir(dir);
  }

  return { converted, skipped, noFFmpeg: false };
}

/**
 * Find and transpile all .tsl files in the project.
 * TSL files are transpiled to .lua and placed in the lua/ directory.
 *
 * Convention: src/tsl/foo.tsl → lua/tsl/foo.lua
 *             (any .tsl file under src/ maps to lua/ with the same relative path)
 *
 * @param {string} cwd - project root
 * @returns {{ transpiled: number, errors: number }}
 */
function transpileTslFiles(cwd) {
  const srcDir = join(cwd, 'src');
  if (!existsSync(srcDir)) return { transpiled: 0, errors: 0 };

  const tslFiles = [];
  const skip = new Set(['node_modules', 'dist', '.git', 'build', 'out']);

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsl')) tslFiles.push(full);
    }
  }
  walk(srcDir);

  if (tslFiles.length === 0) return { transpiled: 0, errors: 0 };

  let transpiled = 0;
  let errors = 0;

  for (const tslPath of tslFiles) {
    // src/tsl/particles.tsl → tsl/particles (relative path without ext)
    const relFromSrc = tslPath.slice(srcDir.length + 1);
    const luaRelPath = relFromSrc.replace(/\.tsl$/, '.lua');
    const outPath = join(cwd, 'lua', luaRelPath);

    try {
      const source = readFileSync(tslPath, 'utf-8');
      const lua = transpile(source, tslPath);

      const outDir = dirname(outPath);
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      writeFileSync(outPath, lua);
      transpiled++;
    } catch (err) {
      console.error(`  TSL error in ${relFromSrc}: ${err.message}`);
      errors++;
    }
  }

  return { transpiled, errors };
}

export async function buildCommand(args) {
  const cwd = process.cwd();
  const projectName = basename(cwd);
  const hasDebugFlag = args.includes('--debug');
  const skipUpdate = args.includes('--no-update');
  const rawTarget = args.filter(a => !a.startsWith('--'))[0]; // e.g. "dist:love", "terminal", or undefined

  // Auto-update runtime files before building (love + sdl2 — both use lua/ runtime; grid/web don't)
  const isLuaTarget = !rawTarget || ['love', 'dist:love', 'sdl2', 'dist:sdl2'].includes(rawTarget);
  if (!skipUpdate && isLuaTarget) {
    await updateCommand([]);
  }

  // Transpile .tsl files → .lua (before lint + bundle, so lint can see generated files)
  if (isLuaTarget) {
    const tsl = transpileTslFiles(cwd);
    if (tsl.errors > 0) {
      console.error(`\n  Build blocked: ${tsl.errors} TSL transpilation error(s).\n`);
      process.exit(1);
    }
    if (tsl.transpiled > 0) {
      console.log(`  TSL: ${tsl.transpiled} file(s) transpiled to lua/\n`);
    }
  }

  // Parse dist:<target> vs plain <target>
  const isDist = rawTarget && rawTarget.startsWith('dist:');
  const targetName = isDist ? rawTarget.slice(5) : rawTarget;

  // No target → SDL2 dev build (primary target)
  if (!rawTarget) {
    await buildDevTarget(cwd, projectName, 'sdl2');
    return;
  }

  // Validate target name
  if (!TARGETS[targetName]) {
    console.error(`Unknown target: ${targetName}`);
    console.error('');
    console.error('  Available targets:');
    console.error(`    ${TARGET_NAMES.join(', ')}`);
    console.error('');
    console.error('  Usage:');
    console.error('    reactjit build                   Bundle JS for dev (SDL2, default)');
    console.error('    reactjit build <target>          Dev build for any target');
    console.error('    reactjit build dist:<target>     Production executable');
    console.error('');
    console.error('  Examples:');
    console.error('    reactjit build terminal          Dev build → dist/main.js');
    console.error('    reactjit build dist:love         Self-extracting Love2D binary');
    console.error('    reactjit build dist:terminal     Single-file Node.js executable');
    process.exit(1);
  }

  const target = TARGETS[targetName];

  if (isDist) {
    if (target.kind === 'love') {
      await buildDistLove(cwd, projectName, { debug: hasDebugFlag });
    } else if (target.kind === 'sdl2') {
      await buildDistSdl2(cwd, projectName, { debug: hasDebugFlag });
    } else if (target.kind === 'web') {
      // Web dist is just the ESM bundle (no shebang — not a Node.js executable)
      await buildDevTarget(cwd, projectName, targetName);
    } else {
      await buildDistGrid(cwd, projectName, targetName);
    }
  } else {
    await buildDevTarget(cwd, projectName, targetName);
  }
}

// ── Helper: find entry point ──────────────────────────────

function findEntry(cwd, ...candidates) {
  for (const c of candidates) {
    const p = join(cwd, c);
    if (existsSync(p)) return p;
  }
  console.error(`No entry point found. Looked for: ${candidates.join(', ')}`);
  process.exit(1);
}

// ── Helper: resolve the lua runtime directory ─────────────

function findLuaRuntime(cwd) {
  const local = join(cwd, 'lua');
  if (existsSync(local)) return local;
  const cliRuntime = join(CLI_ROOT, 'runtime', 'lua');
  if (existsSync(cliRuntime)) return cliRuntime;
  console.error('Lua runtime not found. Run `make cli-setup` or ensure lua/ exists.');
  process.exit(1);
}

// ── Helper: resolve libquickjs.so ─────────────────────────

function findLibQuickJS(cwd) {
  const local = join(cwd, 'lib', 'libquickjs.so');
  if (existsSync(local)) return local;
  const cliRuntime = join(CLI_ROOT, 'runtime', 'lib', 'libquickjs.so');
  if (existsSync(cliRuntime)) return cliRuntime;
  console.error('libquickjs.so not found. Run `make cli-setup` or ensure lib/libquickjs.so exists.');
  process.exit(1);
}

// ── libmpv dep skiplist ───────────────────────────────────
// Transitive deps of libmpv that are not needed for modern video playback.
// Covers: encoders (playback-only), speech engines, linear algebra,
// niche codecs, terminal UI, messaging, and legacy formats.
// These can be patched back in by placing the .so in the project's lib/.
const MPV_DEP_SKIPLIST = new Set([
  // Encoders — playback doesn't need them
  'libx264.so.164',
  'libx265.so.215',
  'libSvtAv1Enc.so.2',
  'librav1e.so.0.7',
  'libshine.so.3',
  'libtwolame.so.0',
  'libvo-amrwbenc.so.0',
  'libxvidcore.so.4',
  // Linear algebra (pulled in by fftw audio filters)
  'libopenblas.so.0',
  'liblapack.so.3',
  'libblas.so.3',
  'libgfortran.so.5',
  // Text-to-speech / speech recognition
  'libflite.so.1',
  'libflite_cmulex.so.1',
  'libflite_cmu_us_awb.so.1',
  'libflite_cmu_us_kal.so.1',
  'libflite_cmu_us_kal16.so.1',
  'libflite_cmu_us_rms.so.1',
  'libflite_cmu_us_slt.so.1',
  'libflite_usenglish.so.1',
  'libpocketsphinx.so.3',
  'libsphinxbase.so.3',
  // Niche / legacy codecs
  'libcodec2.so.1.2',       // Amateur radio voice
  'libopencore-amrnb.so.0',  // AMR narrowband (phone)
  'libopencore-amrwb.so.0',  // AMR wideband (phone)
  'libgsm.so.1',             // GSM voice
  'libopenmpt.so.0',         // MOD/tracker music
  'libgme.so.0',             // Chiptune emulation
  // Terminal / ASCII output (mpv CLI, not Love2D)
  'libcaca.so.0',
  'libsixel.so.1',
  'libslang.so.2',
  'libncursesw.so.6',
  'libtinfo.so.6',
  // Teletext / niche broadcast captions
  'libzvbi.so.0',
  'libaribb24.so.0',
  // CD/DVD/FireWire hardware
  'libcdio.so.19',
  'libcdio_cdda.so.2',
  'libcdio_paranoia.so.2',
  'libdc1394.so.25',
  'libavc1394.so.0',
  'libiec61883.so.0',
  'libraw1394.so.11',
  'librom1394.so.0',
  // Messaging / streaming protocols (not needed for local playback)
  'libzmq.so.5',
  'libpgm-5.3.so.0',
  'libnorm.so.1',
  'libsodium.so.23',
  'librabbitmq.so.4',
  'libsrt-gnutls.so.1.5',
  'librist.so.4',
  // SVG rendering chain (subtitle edge case)
  'librsvg-2.so.2',
  'libgdk_pixbuf-2.0.so.0',
  'libcairo-gobject.so.2',
  // JPEG XL (image codec, not video)
  'libjxl.so.0.11',
  'libjxl_cms.so.0.11',
  'libjxl_threads.so.0.11',
  'libhwy.so.1',
  // Misc unlikely deps
  'libdb-5.3.so',            // Berkeley DB
  'liblua5.2.so.0',          // mpv's own scripting (we use LuaJIT)
  'libmujs.so.3',            // mpv JS scripting
]);

// ── Helper: resolve libmpv.so.2 (optional) ────────────────

function findLibMpv(cwd) {
  const local = join(cwd, 'lib', 'libmpv.so.2');
  if (existsSync(local)) return local;
  const cliRuntime = join(CLI_ROOT, 'runtime', 'lib', 'libmpv.so.2');
  if (existsSync(cliRuntime)) return cliRuntime;
  return null; // optional — video playback won't be available
}

// ── Helper: resolve libsqlite3.so.0 (optional) ────────────

function findLibSqlite3(cwd) {
  const local_ = join(cwd, 'lib', 'libsqlite3.so.0');
  if (existsSync(local_)) return local_;
  const cliRuntime = join(CLI_ROOT, 'runtime', 'lib', 'libsqlite3.so.0');
  if (existsSync(cliRuntime)) return cliRuntime;
  return null; // optional — SQLite features won't be available
}

// ── Helper: resolve tor binary (optional) ─────────────────

function findTorBinary(cwd) {
  const local = join(cwd, 'bin', 'tor');
  if (existsSync(local)) return local;
  const cliRuntime = join(CLI_ROOT, 'runtime', 'bin', 'tor');
  if (existsSync(cliRuntime)) return cliRuntime;
  return null; // optional — .onion hosting won't be available
}

// ── reactjit build [target] (dev build) ─────────────────

async function buildDevTarget(cwd, projectName, targetName) {
  const target = TARGETS[targetName];
  const entryCandidates = target.entries.map(e => `src/${e}`);
  const entry = findEntry(cwd, ...entryCandidates);

  // Lint gate
  const { errors } = await runLint(cwd, { silent: false });
  if (errors > 0) {
    console.error(`\n  Build blocked: ${errors} lint error${errors !== 1 ? 's' : ''} must be fixed first.\n`);
    process.exit(1);
  }

  const outfile = join(cwd, target.output);
  const outdir = dirname(outfile);
  if (!existsSync(outdir)) mkdirSync(outdir, { recursive: true });

  console.log(`\n  Bundling ${projectName} [${targetName}]...\n`);
  execSync([
    'npx', 'esbuild',
    ...esbuildArgs(target),
    `--outfile=${outfile}`,
    ...getEsbuildAliases(cwd),
    entry,
  ].join(' '), { cwd, stdio: 'inherit' });

  // Post-build bundle checks (duplicate contexts, etc.)
  const bundleCheck = runBundleChecks(outfile);
  if (bundleCheck.errors > 0) {
    console.error(`\n  Build blocked: ${bundleCheck.errors} bundle error${bundleCheck.errors !== 1 ? 's' : ''} detected.\n`);
    process.exit(1);
  }

  const hint = targetName === 'love' ? '  Run: love .' : `  Output: ${target.output}`;
  console.log(`\n  Done! ${target.output} written.\n${hint}\n`);
}

// ── reactjit build dist:<grid-target> ───────────────────
//
// Produces a single executable Node.js script with a shebang.
// Works for terminal, cc, nvim, hs, awesome.

async function buildDistGrid(cwd, projectName, targetName) {
  const target = TARGETS[targetName];
  const entryCandidates = target.entries.map(e => `src/${e}`);
  const entry = findEntry(cwd, ...entryCandidates);

  const distDir = join(cwd, 'dist');
  const outFile = join(distDir, `${projectName}-${targetName}`);
  const tmpFile = join('/tmp', `${projectName}-${targetName}.js`);

  console.log(`\n  Building dist:${targetName} for ${projectName}...\n`);

  // Lint gate
  const { errors } = await runLint(cwd, { silent: false });
  if (errors > 0) {
    console.error(`\n  Build blocked: ${errors} lint error${errors !== 1 ? 's' : ''} must be fixed first.\n`);
    process.exit(1);
  }

  mkdirSync(distDir, { recursive: true });

  // Bundle as CJS for Node.js (no ESM module warnings)
  console.log('  [1/2] Bundling JS...');
  execSync([
    'npx', 'esbuild',
    ...esbuildDistArgs(target),
    `--outfile=${tmpFile}`,
    ...getEsbuildAliases(cwd),
    entry,
  ].join(' '), { cwd, stdio: 'pipe' });

  // Post-build bundle checks (duplicate contexts, etc.)
  const bundleCheck = runBundleChecks(tmpFile);
  if (bundleCheck.errors > 0) {
    console.error(`\n  Build blocked: ${bundleCheck.errors} bundle error${bundleCheck.errors !== 1 ? 's' : ''} detected.\n`);
    rmSync(tmpFile, { force: true });
    process.exit(1);
  }

  // Prepend shebang
  console.log('  [2/2] Writing executable...');
  const shebang = Buffer.from('#!/usr/bin/env node\n');
  const js = readFileSync(tmpFile);
  writeFileSync(outFile, Buffer.concat([shebang, js]), { mode: 0o755 });

  rmSync(tmpFile, { force: true });

  const size = ((shebang.length + js.length) / 1024).toFixed(0);
  console.log(`\n  Done! ${size} KB → dist/${projectName}-${targetName}`);
  console.log(`  Run:  ./dist/${projectName}-${targetName}\n`);
}

// ── reactjit build dist:love ────────────────────────────
//
// Produces a single self-extracting binary that runs on any x86_64
// Linux with zero dependencies. Bundles Love2D, all shared libraries
// (including glibc), and the .love game archive.

async function buildDistLove(cwd, projectName, opts = {}) {
  const target = TARGETS.love;
  const entryCandidates = target.entries.map(e => `src/${e}`);
  const entry = findEntry(cwd, ...entryCandidates);
  const luaDir = findLuaRuntime(cwd);
  const libquickjs = findLibQuickJS(cwd);

  const distDir = join(cwd, 'dist');
  const outFile = join(distDir, projectName);
  const stagingDir = join('/tmp', `reactjit-dist-${projectName}`);
  const payloadDir = join('/tmp', `reactjit-payload-${projectName}`);
  const loveArchive = join('/tmp', `${projectName}.love`);

  console.log(`\n  Building dist:love for ${projectName}...\n`);

  // 1. Bundle JS (IIFE for QuickJS)
  console.log('  [1/6] Bundling JS...');
  // Bundle goes into love/ subdir — matching the dev build output path (love/bundle.js).
  // This ensures a single main.lua with bundlePath = "love/bundle.js" works for both
  // `love .` (dev) and the dist .love archive. Do NOT move this back to the root — that
  // is what causes the recurring ping-pong with scaffolded projects.
  const bundlePath = join(stagingDir, 'love', 'bundle.js');
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(join(stagingDir, 'lua'),  { recursive: true });
  mkdirSync(join(stagingDir, 'love'), { recursive: true });

  execSync([
    'npx', 'esbuild',
    ...esbuildArgs(target),
    `--outfile=${bundlePath}`,
    ...getEsbuildAliases(cwd),
    entry,
  ].join(' '), { cwd, stdio: 'pipe' });

  // Post-build bundle checks (duplicate contexts, etc.)
  const bundleCheck = runBundleChecks(bundlePath);
  if (bundleCheck.errors > 0) {
    console.error(`\n  Build blocked: ${bundleCheck.errors} bundle error${bundleCheck.errors !== 1 ? 's' : ''} detected.\n`);
    rmSync(stagingDir, { recursive: true, force: true });
    process.exit(1);
  }

  // 2. Stage the .love contents
  console.log('  [2/6] Staging archive...');

  // main.lua and conf.lua: project packaging/ first, then monorepo packaging/{name}/,
  // then project root, then love/ subdir
  const monoRoot = join(CLI_ROOT, '..');
  const mainLuaSources = [
    join(cwd, 'packaging', 'main.lua'),
    join(monoRoot, 'packaging', projectName, 'main.lua'),
    join(cwd, 'main.lua'),
    join(cwd, 'love', 'main.lua'),
  ];
  const confLuaSources = [
    join(cwd, 'packaging', 'conf.lua'),
    join(monoRoot, 'packaging', projectName, 'conf.lua'),
    join(cwd, 'conf.lua'),
    join(cwd, 'love', 'conf.lua'),
  ];

  const mainLua = mainLuaSources.find(p => existsSync(p));
  const confLua = confLuaSources.find(p => existsSync(p));

  if (!mainLua) {
    console.error('  No main.lua found (checked packaging/main.lua and main.lua)');
    process.exit(1);
  }
  if (!confLua) {
    console.error('  No conf.lua found (checked packaging/conf.lua and conf.lua)');
    process.exit(1);
  }

  cpSync(mainLua, join(stagingDir, 'main.lua'));
  cpSync(confLua, join(stagingDir, 'conf.lua'));
  cpSync(luaDir, join(stagingDir, 'lua'), { recursive: true });

  // Copy fonts into staging if available
  const fontsDirs = [join(cwd, 'fonts'), join(cwd, 'love', 'fonts')];
  const fontsDir = fontsDirs.find(p => existsSync(p));
  if (fontsDir) {
    cpSync(fontsDir, join(stagingDir, 'fonts'), { recursive: true });
  }

  // Copy data into staging if available (dictionary, etc.)
  const dataDirs = [join(cwd, 'data'), join(cwd, 'love', 'data')];
  const dataDir = dataDirs.find(p => existsSync(p));
  if (dataDir) {
    cpSync(dataDir, join(stagingDir, 'data'), { recursive: true });
  }

  // Copy manifest.json into staging if it exists
  const manifestPath = join(cwd, 'manifest.json');
  if (existsSync(manifestPath)) {
    cpSync(manifestPath, join(stagingDir, 'manifest.json'));
    console.log('  Embedded manifest.json');
  }

  // Inspector is now enabled by default in dist builds
  // (Previously disabled unless --debug was passed, but this was annoying for dev)
  // To disable: add `inspector = false` to ReactJIT.init() in your main.lua

  // 2b. Pre-convert video assets to Theora (.ogv) for Love2D
  const videoDirs = [join(cwd, 'assets'), join(cwd, 'src'), cwd];
  const videoResult = convertVideos(videoDirs);
  if (videoResult.noFFmpeg && videoResult.converted === 0) {
    // Only warn if there were actually video files to convert
    // (we don't know without scanning, but ffmpeg missing is worth noting)
  }
  if (videoResult.converted > 0) {
    console.log(`  [video] Converted ${videoResult.converted} video file${videoResult.converted !== 1 ? 's' : ''} to .ogv`);
  }

  // Copy any .ogv video files from project into staging
  function copyVideoAssets(srcDir, destDir) {
    if (!existsSync(srcDir)) return;
    let entries;
    try { entries = readdirSync(srcDir); } catch { return; }
    for (const entry of entries) {
      if (extname(entry).toLowerCase() === '.ogv') {
        const srcFile = join(srcDir, entry);
        mkdirSync(destDir, { recursive: true });
        cpSync(srcFile, join(destDir, entry));
      }
    }
  }
  copyVideoAssets(join(cwd, 'assets'), join(stagingDir, 'assets'));
  copyVideoAssets(cwd, stagingDir);

  // 3. Create .love archive
  console.log('  [3/6] Creating .love archive...');
  execSync(`cd "${stagingDir}" && zip -9 -r "${loveArchive}" .`, { stdio: 'pipe' });

  // 4. Find love binary and bundle shared libraries
  console.log('  [4/6] Bundling Love2D + shared libraries...');
  let loveBin;
  try {
    loveBin = execSync('readlink -f $(which love)', { encoding: 'utf-8' }).trim();
  } catch {
    console.error('  Love2D not found. Install it: https://love2d.org');
    process.exit(1);
  }

  rmSync(payloadDir, { recursive: true, force: true });
  mkdirSync(join(payloadDir, 'lib'), { recursive: true });

  cpSync(loveBin, join(payloadDir, 'love.bin'));
  cpSync(loveArchive, join(payloadDir, 'game.love'));
  cpSync(libquickjs, join(payloadDir, 'lib', 'libquickjs.so'));

  // Bundle libmpv if available (optional — video playback)
  const libmpv = findLibMpv(cwd);
  if (libmpv) {
    cpSync(libmpv, join(payloadDir, 'lib', 'libmpv.so.2'));
    // Bundle libmpv's transitive deps, skipping encoders/niche libs
    let mpvIncluded = 0, mpvSkipped = 0;
    try {
      const mpvLdd = execSync(`ldd "${libmpv}"`, { encoding: 'utf-8' });
      for (const line of mpvLdd.split('\n')) {
        if (line.includes('linux-vdso')) continue;
        const match = line.match(/^\s*(\S+)\s+=>\s+(\S+)/);
        if (match) {
          const [, soname, path] = match;
          if (MPV_DEP_SKIPLIST.has(soname)) { mpvSkipped++; continue; }
          const dest = join(payloadDir, 'lib', soname);
          if (!existsSync(dest)) {
            try {
              const real = execSync(`readlink -f "${path}"`, { encoding: 'utf-8' }).trim();
              cpSync(real, dest);
              mpvIncluded++;
            } catch { /* skip unresolvable */ }
          }
        }
      }
    } catch { /* ldd failed — still have the .so itself */ }
    console.log(`  Bundled libmpv + ${mpvIncluded} deps (skipped ${mpvSkipped} non-essential)`);
  }

  // Bundle libsqlite3 if available (optional — SQLite features)
  const libsqlite3 = findLibSqlite3(cwd);
  if (libsqlite3) {
    cpSync(libsqlite3, join(payloadDir, 'lib', 'libsqlite3.so.0'));
    console.log('  Bundled libsqlite3.so.0');
  }

  // Bundle tor binary if available (optional — .onion hosting)
  const torBin = findTorBinary(cwd);
  if (torBin) {
    mkdirSync(join(payloadDir, 'bin'), { recursive: true });
    cpSync(torBin, join(payloadDir, 'bin', 'tor'));
    execSync(`chmod +x "${join(payloadDir, 'bin', 'tor')}"`);
    // Bundle tor's transitive deps
    try {
      const torLdd = execSync(`ldd "${torBin}"`, { encoding: 'utf-8' });
      for (const line of torLdd.split('\n')) {
        if (line.includes('linux-vdso')) continue;
        const match = line.match(/^\s*(\S+)\s+=>\s+(\S+)/);
        if (match) {
          const [, soname, path] = match;
          const dest = join(payloadDir, 'lib', soname);
          if (!existsSync(dest)) {
            try {
              const real = execSync(`readlink -f "${path}"`, { encoding: 'utf-8' }).trim();
              cpSync(real, dest);
            } catch { /* skip unresolvable */ }
          }
        }
      }
    } catch { /* ldd failed — still have the binary itself */ }
    console.log('  Bundled tor + dependencies');
  }

  // Bundle ALL shared libraries (same technique as Steam Runtime / AppImage)
  const lddOutput = execSync(`ldd "${loveBin}"`, { encoding: 'utf-8' });
  for (const line of lddOutput.split('\n')) {
    if (line.includes('linux-vdso')) continue;
    const match = line.match(/^\s*(\S+)\s+=>\s+(\S+)/);
    if (match) {
      const [, soname, path] = match;
      try {
        const real = execSync(`readlink -f "${path}"`, { encoding: 'utf-8' }).trim();
        cpSync(real, join(payloadDir, 'lib', soname));
      } catch { /* skip unresolvable */ }
    }
  }

  // Bundle the dynamic linker itself
  try {
    const ldLinux = execSync('readlink -f /lib64/ld-linux-x86-64.so.2', { encoding: 'utf-8' }).trim();
    cpSync(ldLinux, join(payloadDir, 'lib', 'ld-linux-x86-64.so.2'));
  } catch {
    console.error('  Could not find ld-linux. Are you on x86_64 Linux?');
    process.exit(1);
  }

  // 5. Create launcher script
  console.log('  [5/6] Creating launcher...');
  const launcher =
    '#!/bin/sh\n' +
    'DIR="$(cd "$(dirname "$0")" && pwd)"\n' +
    'exec "$DIR/lib/ld-linux-x86-64.so.2" --inhibit-cache --library-path "$DIR/lib" "$DIR/love.bin" "$DIR/game.love" "$@"\n';
  writeFileSync(join(payloadDir, 'run'), launcher, { mode: 0o755 });

  // 6. Pack into single self-extracting binary
  console.log('  [6/6] Packing self-extracting binary...');
  mkdirSync(distDir, { recursive: true });

  const tarball = join('/tmp', `${projectName}-payload.tar.gz`);
  execSync(`cd "${payloadDir}" && tar czf "${tarball}" .`, { stdio: 'pipe' });

  const header =
    '#!/bin/sh\n' +
    'set -e\n' +
    `APP_DIR=\${XDG_CACHE_HOME:-$HOME/.cache}/reactjit-${projectName}\n` +
    'SIG=$(md5sum "$0" 2>/dev/null | cut -c1-8 || cksum "$0" | cut -d" " -f1)\n' +
    'CACHE="$APP_DIR/$SIG"\n' +
    'if [ ! -f "$CACHE/.ready" ]; then\n' +
    '  rm -rf "$APP_DIR"\n' +
    '  mkdir -p "$CACHE"\n' +
    '  SKIP=$(awk \'/^__ARCHIVE__$/{print NR + 1; exit}\' "$0")\n' +
    '  tail -n+"$SKIP" "$0" | tar xz -C "$CACHE"\n' +
    '  touch "$CACHE/.ready"\n' +
    'fi\n' +
    'exec "$CACHE/run" "$@"\n' +
    '__ARCHIVE__\n';

  const headerBuf = Buffer.from(header);
  const tarBuf = readFileSync(tarball);
  const out = Buffer.concat([headerBuf, tarBuf]);
  writeFileSync(outFile, out, { mode: 0o755 });

  // Cleanup
  rmSync(stagingDir, { recursive: true, force: true });
  rmSync(payloadDir, { recursive: true, force: true });
  rmSync(loveArchive, { force: true });
  rmSync(tarball, { force: true });

  const size = (out.length / (1024 * 1024)).toFixed(1);
  console.log(`\n  Done! ${size} MB → dist/${projectName}`);
  console.log(`  Run:  ./dist/${projectName}\n`);
}

// ── reactjit build dist:sdl2 ────────────────────────────
//
// Self-extracting binary: LuaJIT + SDL2 + FreeType + ft_helper.so +
// libquickjs.so + lua runtime + JS bundle.
// No Love2D, no X11/Wayland required. Launches via SDL2 kmsdrm or
// whatever display backend SDL2 auto-detects on the target system.

async function buildDistSdl2(cwd, projectName, opts = {}) {
  const target = TARGETS.sdl2;
  const entryCandidates = target.entries.map(e => `src/${e}`);
  const entry = findEntry(cwd, ...entryCandidates);
  const luaDir = findLuaRuntime(cwd);
  const libquickjs = findLibQuickJS(cwd);

  const distDir    = join(cwd, 'dist');
  const outFile    = join(distDir, `${projectName}-sdl2`);
  const stagingDir = join('/tmp', `reactjit-sdl2-${projectName}`);
  const payloadDir = join('/tmp', `reactjit-sdl2-payload-${projectName}`);

  console.log(`\n  Building dist:sdl2 for ${projectName}...\n`);

  // 1. Lint gate
  const { errors } = await runLint(cwd, { silent: false });
  if (errors > 0) {
    console.error(`\n  Build blocked: ${errors} lint error(s).\n`);
    process.exit(1);
  }

  // 2. Bundle JS (IIFE — runs inside QuickJS, same as Love2D)
  console.log('  [1/5] Bundling JS...');
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(join(stagingDir, 'lua'), { recursive: true });
  mkdirSync(join(stagingDir, 'sdl2'), { recursive: true });
  mkdirSync(join(stagingDir, 'lib'),  { recursive: true });

  const bundlePath = join(stagingDir, 'sdl2', 'bundle.js');
  execSync([
    'npx', 'esbuild',
    ...esbuildArgs(target),
    `--outfile=${bundlePath}`,
    ...getEsbuildAliases(cwd),
    entry,
  ].join(' '), { cwd, stdio: 'pipe' });

  const bundleCheck = runBundleChecks(bundlePath);
  if (bundleCheck.errors > 0) {
    console.error(`\n  Build blocked: ${bundleCheck.errors} bundle error(s).\n`);
    rmSync(stagingDir, { recursive: true, force: true });
    process.exit(1);
  }

  // 3. Stage lua runtime + entry point
  console.log('  [2/5] Staging Lua runtime...');
  cpSync(luaDir, join(stagingDir, 'lua'), { recursive: true });

  // Project entry point (sdl2_main.lua or generated stub)
  const sdl2MainCandidates = [
    join(cwd, 'sdl2_main.lua'),
    join(cwd, 'main-sdl2.lua'),
  ];
  const sdl2Main = sdl2MainCandidates.find(p => existsSync(p));
  if (sdl2Main) {
    cpSync(sdl2Main, join(stagingDir, 'main.lua'));
  } else {
    // Generate a default launcher
    const stub =
      'require("lua.sdl2_init").run({\n' +
      '  bundle = "sdl2/bundle.js",\n' +
      `  title  = "${projectName}",\n` +
      '})\n';
    writeFileSync(join(stagingDir, 'main.lua'), stub);
  }

  // Copy manifest.json into staging if it exists
  const manifestPathSdl2 = join(cwd, 'manifest.json');
  if (existsSync(manifestPathSdl2)) {
    cpSync(manifestPathSdl2, join(stagingDir, 'manifest.json'));
    console.log('  Embedded manifest.json');
  }

  // 4. Bundle shared libraries
  console.log('  [3/5] Bundling SDL2 + FreeType + QuickJS...');
  rmSync(payloadDir, { recursive: true, force: true });
  mkdirSync(join(payloadDir, 'lib'), { recursive: true });

  // Copy staging into payload
  cpSync(stagingDir, payloadDir, { recursive: true });

  // libquickjs.so
  cpSync(libquickjs, join(payloadDir, 'lib', 'libquickjs.so'));

  // ft_helper.so (compiled C bridge for FreeType)
  const ftHelperCandidates = [
    join(cwd, 'lib', 'ft_helper.so'),
    join(CLI_ROOT, 'runtime', 'lib', 'ft_helper.so'),
  ];
  const ftHelper = ftHelperCandidates.find(p => existsSync(p));
  if (!ftHelper) {
    console.error('  ft_helper.so not found. Run: make cli-setup');
    process.exit(1);
  }
  cpSync(ftHelper, join(payloadDir, 'lib', 'ft_helper.so'));

  // Resolve SDL2 and its deps
  const sdl2Lib = execSync('ldconfig -p | grep "libSDL2-2.0.so.0 " | grep x86-64 | awk \'{print $NF}\' | head -1',
    { encoding: 'utf-8' }).trim();
  if (!sdl2Lib) {
    console.error('  libSDL2-2.0.so.0 not found. Install libsdl2.');
    process.exit(1);
  }
  const bundleLibWithDeps = (libPath, destDir) => {
    const soname = basename(libPath);
    const dest   = join(destDir, soname);
    if (!existsSync(dest)) {
      try { cpSync(execSync(`readlink -f "${libPath}"`, { encoding: 'utf-8' }).trim(), dest); } catch {}
    }
    try {
      const lddOut = execSync(`ldd "${libPath}"`, { encoding: 'utf-8' });
      for (const line of lddOut.split('\n')) {
        if (line.includes('linux-vdso')) continue;
        const m = line.match(/^\s*(\S+)\s+=>\s+(\S+)/);
        if (m) {
          const [, name, path] = m;
          const d = join(destDir, name);
          if (!existsSync(d)) {
            try { cpSync(execSync(`readlink -f "${path}"`, { encoding: 'utf-8' }).trim(), d); } catch {}
          }
        }
      }
    } catch {}
  };
  bundleLibWithDeps(sdl2Lib, join(payloadDir, 'lib'));

  // FreeType
  const freetypeLib = execSync('ldconfig -p | grep "libfreetype.so.6 " | grep x86-64 | awk \'{print $NF}\' | head -1',
    { encoding: 'utf-8' }).trim();
  if (freetypeLib) bundleLibWithDeps(freetypeLib, join(payloadDir, 'lib'));

  // LuaJIT binary
  const luajitBin = execSync('readlink -f $(which luajit)', { encoding: 'utf-8' }).trim();
  cpSync(luajitBin, join(payloadDir, 'luajit.bin'));
  bundleLibWithDeps(luajitBin, join(payloadDir, 'lib'));

  // Bundle the dynamic linker
  try {
    const ld = execSync('readlink -f /lib64/ld-linux-x86-64.so.2', { encoding: 'utf-8' }).trim();
    cpSync(ld, join(payloadDir, 'lib', 'ld-linux-x86-64.so.2'));
  } catch {
    console.error('  ld-linux not found. x86_64 Linux required for dist:sdl2.');
    process.exit(1);
  }

  // 5. Launcher + pack
  console.log('  [4/5] Creating launcher...');
  const launcher =
    '#!/bin/sh\n' +
    'DIR="$(cd "$(dirname "$0")" && pwd)"\n' +
    'export LD_PRELOAD=\n' +
    'exec "$DIR/lib/ld-linux-x86-64.so.2" --inhibit-cache \\\n' +
    '     --library-path "$DIR/lib" \\\n' +
    '     "$DIR/luajit.bin" "$DIR/main.lua" "$@"\n';
  writeFileSync(join(payloadDir, 'run'), launcher, { mode: 0o755 });

  console.log('  [5/5] Packing self-extracting binary...');
  mkdirSync(distDir, { recursive: true });

  const tarball = join('/tmp', `${projectName}-sdl2-payload.tar.gz`);
  execSync(`cd "${payloadDir}" && tar czf "${tarball}" .`, { stdio: 'pipe' });

  const header =
    '#!/bin/sh\n' +
    'set -e\n' +
    `APP_DIR=\${XDG_CACHE_HOME:-$HOME/.cache}/reactjit-${projectName}-sdl2\n` +
    'SIG=$(md5sum "$0" 2>/dev/null | cut -c1-8 || cksum "$0" | cut -d" " -f1)\n' +
    'CACHE="$APP_DIR/$SIG"\n' +
    'if [ ! -f "$CACHE/.ready" ]; then\n' +
    '  rm -rf "$APP_DIR"\n' +
    '  mkdir -p "$CACHE"\n' +
    '  SKIP=$(awk \'/^__ARCHIVE__$/{print NR + 1; exit}\' "$0")\n' +
    '  tail -n+"$SKIP" "$0" | tar xz -C "$CACHE"\n' +
    '  touch "$CACHE/.ready"\n' +
    'fi\n' +
    'exec "$CACHE/run" "$@"\n' +
    '__ARCHIVE__\n';

  const headerBuf = Buffer.from(header);
  const tarBuf    = readFileSync(tarball);
  const out       = Buffer.concat([headerBuf, tarBuf]);
  writeFileSync(outFile, out, { mode: 0o755 });

  rmSync(stagingDir, { recursive: true, force: true });
  rmSync(payloadDir, { recursive: true, force: true });
  rmSync(tarball,    { force: true });

  const sizeMb = (out.length / (1024 * 1024)).toFixed(1);
  console.log(`\n  Done! ${sizeMb} MB → dist/${projectName}-sdl2`);
  console.log(`  Run:  ./dist/${projectName}-sdl2`);
  console.log(`  Note: Requires a display (X11, Wayland, or KMS/DRM).\n`);
}
