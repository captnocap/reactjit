import { existsSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runLint, runBundleChecks } from './lint.mjs';
import { updateCommand } from './update.mjs';
import { TARGETS, esbuildArgs, PLATFORMS, BUILD_ALIASES, detectHostPlatform } from '../targets.mjs';
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
  const skipLint = args.includes('--no-lint');
  const skipUpdate = args.includes('--no-update');
  const targetPlatformIdx = args.indexOf('--target');
  const targetPlatform = targetPlatformIdx !== -1 ? args[targetPlatformIdx + 1] : null;
  let rawTarget = args.filter(a => !a.startsWith('--') && a !== targetPlatform)[0]; // e.g. "dist:love", "linux", or undefined

  // Resolve friendly build aliases (e.g. "linux" → dist:love --target linux-x64)
  const alias = rawTarget && BUILD_ALIASES[rawTarget];
  let resolvedPlatform = targetPlatform;
  if (alias) {
    rawTarget = `dist:${alias.target}`;
    resolvedPlatform = resolvedPlatform || alias.platform;
  }

  // Auto-update runtime files before building (love + web — all use lua/ runtime)
  // Skip for storybook — it reads from source via symlinks, no update needed
  const isLuaTarget = !rawTarget || ['love', 'dist:love', 'web', 'dist:web'].includes(rawTarget);
  const isStorybook = existsSync(join(cwd, '..', 'packages', 'core')) &&
    existsSync(join(cwd, '..', 'lua')) &&
    existsSync(join(cwd, 'love'));
  if (!skipUpdate && isLuaTarget && !isStorybook) {
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

  // No target → Love2D dev build (primary target)
  if (!rawTarget) {
    await buildDevTarget(cwd, projectName, 'love', { skipLint });
    return;
  }

  // Validate target name
  if (!TARGETS[targetName]) {
    console.error(`Unknown target: ${targetName}`);
    console.error('');
    console.error('  Production builds:');
    console.error('    rjit build linux                 Self-extracting Linux binary (x64)');
    console.error('    rjit build macos                 macOS bundle (Intel x64)');
    console.error('    rjit build macmseries            macOS bundle (Apple Silicon arm64)');
    console.error('    rjit build windows               Windows archive (x64)');
    console.error('    rjit build web                   WASM bundle (love.js)');
    console.error('    rjit build dist:love             Self-extracting Love2D binary');
    console.error('');
    console.error('  Dev builds:');
    console.error('    rjit build                       Love2D dev build (default)');
    console.error('    rjit build love                  Love2D dev build');
    process.exit(1);
  }

  const target = TARGETS[targetName];

  if (isDist) {
    if (target.kind === 'love') {
      await buildDistLove(cwd, projectName, { debug: hasDebugFlag, skipLint, targetPlatform: resolvedPlatform });
    } else if (target.kind === 'web') {
      await buildDistWeb(cwd, projectName, { debug: hasDebugFlag, skipLint });
    } else {
      await buildDistGrid(cwd, projectName, targetName, { skipLint });
    }
  } else {
    await buildDevTarget(cwd, projectName, targetName, { skipLint });
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

async function buildDevTarget(cwd, projectName, targetName, opts = {}) {
  const target = TARGETS[targetName];
  const entryCandidates = target.entries.map(e => `src/${e}`);
  const entry = findEntry(cwd, ...entryCandidates);

  // Lint gate
  if (!opts.skipLint) {
    const { errors } = await runLint(cwd, { silent: false });
    if (errors > 0) {
      console.error(`\n  Build blocked: ${errors} lint error${errors !== 1 ? 's' : ''} must be fixed first.\n`);
      process.exit(1);
    }
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

async function buildDistGrid(cwd, projectName, targetName, opts = {}) {
  const target = TARGETS[targetName];
  const entryCandidates = target.entries.map(e => `src/${e}`);
  const entry = findEntry(cwd, ...entryCandidates);

  const distDir = join(cwd, 'dist');
  const outFile = join(distDir, `${projectName}-${targetName}`);
  const tmpFile = join('/tmp', `${projectName}-${targetName}.js`);

  console.log(`\n  Building dist:${targetName} for ${projectName}...\n`);

  // Lint gate
  if (!opts.skipLint) {
    const { errors } = await runLint(cwd, { silent: false });
    if (errors > 0) {
      console.error(`\n  Build blocked: ${errors} lint error${errors !== 1 ? 's' : ''} must be fixed first.\n`);
      process.exit(1);
    }
  }

  mkdirSync(distDir, { recursive: true });

  // Bundle as CJS for Node.js (no ESM module warnings)
  console.log('  [1/2] Bundling JS...');
  execSync([
    'npx', 'esbuild',
    ...esbuildArgs(target),
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

  // 4. Resolve target platform and branch packaging
  const targetPlatform = opts.targetPlatform || detectHostPlatform() || 'linux-x64';
  const plat = PLATFORMS[targetPlatform] || PLATFORMS['linux-x64'];

  console.log(`  [4/6] Bundling Love2D for ${plat.os}...`);

  rmSync(payloadDir, { recursive: true, force: true });
  mkdirSync(join(payloadDir, 'lib'), { recursive: true });
  mkdirSync(distDir, { recursive: true });

  cpSync(loveArchive, join(payloadDir, 'game.love'));

  if (plat.os === 'linux') {
    // ── Linux: self-extracting binary with bundled Love2D + glibc ──
    let loveBin;
    try {
      loveBin = execSync('readlink -f $(which love)', { encoding: 'utf-8' }).trim();
    } catch {
      console.error('  Love2D not found. Install it: https://love2d.org');
      process.exit(1);
    }

    cpSync(loveBin, join(payloadDir, 'love.bin'));
    cpSync(libquickjs, join(payloadDir, 'lib', 'libquickjs.so'));

    // Bundle libmpv if available (optional — video playback)
    const libmpv = findLibMpv(cwd);
    if (libmpv) {
      cpSync(libmpv, join(payloadDir, 'lib', 'libmpv.so.2'));
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
    rmSync(tarball, { force: true });

    const size = (out.length / (1024 * 1024)).toFixed(1);
    console.log(`\n  Done! ${size} MB → dist/${projectName}`);
    console.log(`  Run:  ./dist/${projectName}\n`);

  } else if (plat.os === 'macos') {
    // ── macOS: .app bundle with fused Love2D ──
    // Look for a vendored Love2D.app at known paths
    const monoRoot = join(CLI_ROOT, '..');
    const vendorAppCandidates = [
      join(cwd, 'vendor', 'love.app'),
      join(cwd, 'vendor', 'Love.app'),
      join(monoRoot, 'vendor', 'love.app'),
      join(monoRoot, 'vendor', 'Love.app'),
      '/Applications/love.app',
      '/Applications/Love.app',
    ];
    const vendorApp = vendorAppCandidates.find(p => existsSync(p));
    if (!vendorApp) {
      console.error('  macOS Love2D.app not found.');
      console.error('  Place Love.app in one of these locations:');
      console.error('    <project>/vendor/Love.app');
      console.error('    <monorepo>/vendor/Love.app');
      console.error('    /Applications/Love.app');
      console.error('  Download from: https://love2d.org');
      process.exit(1);
    }

    console.log(`  [5/6] Creating .app bundle from ${vendorApp}...`);
    const appName = `${projectName}.app`;
    const appDir = join(distDir, appName);
    rmSync(appDir, { recursive: true, force: true });

    // Copy the Love2D.app template
    cpSync(vendorApp, appDir, { recursive: true });

    // Inject the .love archive into Resources/
    const resourcesDir = join(appDir, 'Contents', 'Resources');
    mkdirSync(resourcesDir, { recursive: true });
    cpSync(loveArchive, join(resourcesDir, 'game.love'));

    // Copy libquickjs into Frameworks/ so the app can find it at runtime
    const frameworksDir = join(appDir, 'Contents', 'Frameworks');
    mkdirSync(frameworksDir, { recursive: true });
    if (existsSync(libquickjs)) {
      cpSync(libquickjs, join(frameworksDir, 'libquickjs.dylib'));
    }

    // Update Info.plist to set the app name
    const plistPath = join(appDir, 'Contents', 'Info.plist');
    if (existsSync(plistPath)) {
      let plist = readFileSync(plistPath, 'utf-8');
      // Replace bundle name with project name
      plist = plist.replace(/<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleName</key>\n\t<string>${projectName}</string>`);
      writeFileSync(plistPath, plist);
    }

    console.log('  [6/6] Packaging...');
    // Create a tar.gz of the .app for distribution
    const archivePath = join(distDir, `${projectName}-macos.tar.gz`);
    execSync(`cd "${distDir}" && tar czf "${basename(archivePath)}" "${appName}"`, { stdio: 'pipe' });

    const sizeMb = (statSync(archivePath).size / (1024 * 1024)).toFixed(1);
    console.log(`\n  Done! ${sizeMb} MB → ${archivePath}`);
    console.log(`  Extract and run: open ${appName}\n`);

  } else if (plat.os === 'windows') {
    // ── Windows: fuse love.exe + .love into single exe ──
    const monoRoot = join(CLI_ROOT, '..');
    const vendorExeCandidates = [
      join(cwd, 'vendor', 'love.exe'),
      join(monoRoot, 'vendor', 'love.exe'),
    ];
    const vendorExe = vendorExeCandidates.find(p => existsSync(p));
    if (!vendorExe) {
      console.error('  Windows love.exe not found.');
      console.error('  Place love.exe (and its DLLs) in one of these locations:');
      console.error('    <project>/vendor/love.exe');
      console.error('    <monorepo>/vendor/love.exe');
      console.error('  Download from: https://love2d.org');
      process.exit(1);
    }

    const vendorDir = dirname(vendorExe);

    console.log('  [5/6] Fusing love.exe + game.love...');
    // Fuse: cat love.exe + game.love > output.exe
    const fusedExe = join(distDir, `${projectName}.exe`);
    const loveBuf = readFileSync(vendorExe);
    const gameBuf = readFileSync(loveArchive);
    writeFileSync(fusedExe, Buffer.concat([loveBuf, gameBuf]));

    // Copy DLLs from vendor directory alongside the exe
    console.log('  [6/6] Copying DLLs...');
    let dllCount = 0;
    if (existsSync(vendorDir)) {
      for (const entry of readdirSync(vendorDir)) {
        if (entry.toLowerCase().endsWith('.dll')) {
          cpSync(join(vendorDir, entry), join(distDir, entry));
          dllCount++;
        }
      }
    }

    // Copy libquickjs.dll if available
    const quickjsDll = join(vendorDir, 'libquickjs.dll');
    if (existsSync(quickjsDll)) {
      cpSync(quickjsDll, join(distDir, 'libquickjs.dll'));
    }

    const sizeMb = (statSync(fusedExe).size / (1024 * 1024)).toFixed(1);
    console.log(`\n  Done! ${sizeMb} MB → ${fusedExe} (+ ${dllCount} DLLs)`);
    console.log(`  Run:  ${projectName}.exe\n`);

  } else {
    console.error(`  Unsupported platform for dist:love: ${plat.os}`);
    process.exit(1);
  }

  // Cleanup
  rmSync(stagingDir, { recursive: true, force: true });
  rmSync(payloadDir, { recursive: true, force: true });
  rmSync(loveArchive, { force: true });
}


// ── reactjit build web / dist:web ───────────────────────────────────
//
// Produces a dist/web/ directory containing:
//   index.html     – HTML shell with <canvas>
//   love.js        – Emscripten glue (from vendored love.js)
//   love.wasm      – Compiled Love2D engine (from vendored love.js)
//   game.data      – .love archive (Lua runtime + rendering pipeline, FFI files stripped)
//   bridge.js      – Browser-side Module.FS bridge
//   bundle.js      – React IIFE bundle
//
// The .love archive excludes all FFI-dependent Lua files since love.js
// uses PUC Lua 5.1 (no LuaJIT FFI). The core rendering pipeline
// (painter, layout, tree, events, measure, images) is pure Lua + Love2D APIs.

const WEB_FFI_EXCLUDES = [
  'bridge_quickjs.lua',
  'lib_loader.lua',
  'videos.lua',
  'sqlite.lua',
  'archive.lua',
  'crypto.lua',
  'dragdrop.lua',
  'emulator.lua',
  'quarantine.lua',
  'image_select.lua',
  'miner_signatures.lua',
  'window_manager.lua',
  // PUC Lua 5.1 incompatible (uses goto, a LuaJIT/5.2+ feature)
  'map.lua',
  'tilecache.lua',
  'browse.lua',
  'docstore.lua',
  'websocket.lua',
  'wsserver.lua',
];

const WEB_FFI_EXCLUDE_DIRS = [
  'gpio',
];

const WEB_FFI_EXCLUDE_SUBPATHS = [
  join('audio', 'midi.lua'),
  join('audio', 'modules', 'lfo.lua'),
  join('capabilities', 'image_select.lua'),
  join('capabilities', 'step_sequencer.lua'),
];

function copyLuaDirStripped(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (WEB_FFI_EXCLUDE_DIRS.includes(entry.name)) continue;
      copyLuaDirStripped(srcPath, destPath);
    } else {
      if (WEB_FFI_EXCLUDES.includes(entry.name)) continue;
      cpSync(srcPath, destPath);
    }
  }
}

async function buildDistWeb(cwd, projectName, opts = {}) {
  const target = TARGETS.web;
  const entryCandidates = target.entries.map(e => `src/${e}`);
  const entry = findEntry(cwd, ...entryCandidates);
  const luaDir = findLuaRuntime(cwd);

  const monoRoot = join(CLI_ROOT, '..');
  const distDir = join(cwd, 'dist', 'web');
  const stagingDir = join('/tmp', `reactjit-web-${projectName}`);

  console.log(`\n  Building web for ${projectName}...\n`);

  // 1. Lint gate
  if (!opts.skipLint) {
    const { errors } = await runLint(cwd, { silent: false });
    if (errors > 0) {
      console.error(`\n  Build blocked: ${errors} lint error(s).\n`);
      process.exit(1);
    }
  }

  // 2. Bundle JS (IIFE for browser)
  console.log('  [1/5] Bundling JS...');
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  const bundlePath = join(stagingDir, 'bundle.js');
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

  // 3. Stage .love archive contents (Lua runtime with FFI files stripped)
  console.log('  [2/5] Staging Lua runtime (stripping FFI files)...');
  const loveStaging = join('/tmp', `reactjit-web-love-${projectName}`);
  rmSync(loveStaging, { recursive: true, force: true });
  mkdirSync(loveStaging, { recursive: true });

  // Copy lua/ with FFI exclusions
  copyLuaDirStripped(luaDir, join(loveStaging, 'lua'));

  // Remove sub-path exclusions
  for (const subpath of WEB_FFI_EXCLUDE_SUBPATHS) {
    const target_ = join(loveStaging, 'lua', subpath);
    if (existsSync(target_)) rmSync(target_, { force: true });
  }

  // main.lua and conf.lua for web — check packaging/web/ first, then project
  const webMainSources = [
    join(cwd, 'packaging', 'web', 'main.lua'),
    join(monoRoot, 'packaging', 'web', 'main.lua'),
  ];
  const webConfSources = [
    join(cwd, 'packaging', 'web', 'conf.lua'),
    join(monoRoot, 'packaging', 'web', 'conf.lua'),
  ];

  const mainLua = webMainSources.find(p => existsSync(p));
  const confLua = webConfSources.find(p => existsSync(p));

  if (!mainLua) {
    console.error('  No web main.lua found (checked packaging/web/main.lua)');
    process.exit(1);
  }
  if (!confLua) {
    console.error('  No web conf.lua found (checked packaging/web/conf.lua)');
    process.exit(1);
  }

  cpSync(mainLua, join(loveStaging, 'main.lua'));
  cpSync(confLua, join(loveStaging, 'conf.lua'));

  // Write a minimal manifest.json — manifest.lua requires it at load time and
  // love.js turns missing-file into a hard error on the canvas.
  const manifestPath = join(cwd, 'manifest.json');
  if (existsSync(manifestPath)) {
    cpSync(manifestPath, join(loveStaging, 'manifest.json'));
  } else {
    writeFileSync(join(loveStaging, 'manifest.json'), JSON.stringify({
      name: projectName,
      version: '0.1.0',
      capabilities: {},
    }, null, 2));
  }

  // Copy fonts if available
  const fontsDirs = [join(cwd, 'fonts'), join(cwd, 'love', 'fonts')];
  const fontsDir = fontsDirs.find(p => existsSync(p));
  if (fontsDir) cpSync(fontsDir, join(loveStaging, 'fonts'), { recursive: true });

  // Copy data if available
  const dataDirs = [join(cwd, 'data'), join(cwd, 'love', 'data')];
  const dataDir = dataDirs.find(p => existsSync(p));
  if (dataDir) cpSync(dataDir, join(loveStaging, 'data'), { recursive: true });

  // Count stripped files for reporting
  let strippedCount = WEB_FFI_EXCLUDES.length + WEB_FFI_EXCLUDE_DIRS.length + WEB_FFI_EXCLUDE_SUBPATHS.length;
  console.log(`  Stripped ${strippedCount} FFI-dependent files/dirs from Lua runtime`);

  // 4. Package with love.js CLI (generates game.js + game.data + love.js + love.wasm)
  console.log('  [3/5] Packaging with love.js...');
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(distDir, { recursive: true });

  // Use love.js CLI to package the staging directory → dist/web/
  // This generates: game.js (Emscripten data loader), game.data, love.js, love.wasm,
  // love.worker.js, and a default index.html.
  try {
    execSync(
      `npx love.js "${loveStaging}" "${distDir}" -t "${projectName}" -m 67108864 -c`,
      { cwd, stdio: 'pipe' }
    );
  } catch (e) {
    console.error('  love.js packaging failed. Install it: npm install -g love.js');
    console.error('  Or: npx love.js');
    if (e.stderr) console.error(e.stderr.toString());
    process.exit(1);
  }

  // 4b. Patch love.js to expose Emscripten FS on Module.
  // The compat build keeps FS internal to the closure — we need it for bridge I/O.
  const lovejsPath = join(distDir, 'love.js');
  if (existsSync(lovejsPath)) {
    let lovejs = readFileSync(lovejsPath, 'utf-8');
    // Insert Module["FS"]=FS right after the FS object definition
    const fsInit = 'var FS={root:null,mounts:[],devices:{';
    if (lovejs.includes(fsInit)) {
      // Find the end of the FS object literal — look for the matching closing brace
      // Instead, inject after a known stable point: after FS.staticInit() call
      const staticInit = 'FS.staticInit()';
      const idx = lovejs.indexOf(staticInit);
      if (idx >= 0) {
        const insertAt = lovejs.indexOf(';', idx) + 1;
        lovejs = lovejs.slice(0, insertAt) + 'Module["FS"]=FS;' + lovejs.slice(insertAt);
        writeFileSync(lovejsPath, lovejs);
        console.log('  Patched love.js to expose Module.FS');
      }
    }
  }

  // 5. Overlay our custom files on top of love.js output
  console.log('  [4/5] Overlaying custom bridge + bundle...');

  // Copy our React bundle
  cpSync(bundlePath, join(distDir, 'bundle.js'));

  // Copy our bridge.js
  const bridgeSources = [
    join(cwd, 'packaging', 'web', 'bridge.js'),
    join(monoRoot, 'packaging', 'web', 'bridge.js'),
  ];
  const bridgeJs = bridgeSources.find(p => existsSync(p));
  if (bridgeJs) cpSync(bridgeJs, join(distDir, 'bridge.js'));

  // Replace index.html with our custom one (includes bridge.js + bundle.js loading)
  const localHtml = join(cwd, 'packaging', 'web', 'index.html');
  const defaultHtml = join(monoRoot, 'packaging', 'web', 'index.html');

  // Scaffold the template into the project on first web build so users
  // can customize their loading screen.
  if (!existsSync(localHtml) && existsSync(defaultHtml)) {
    mkdirSync(join(cwd, 'packaging', 'web'), { recursive: true });
    cpSync(defaultHtml, localHtml);
    console.log('  Created packaging/web/index.html — customize your loading screen here');
  }

  const htmlSource = existsSync(localHtml) ? localHtml : defaultHtml;
  if (htmlSource && existsSync(htmlSource)) {
    let html = readFileSync(htmlSource, 'utf-8');
    html = html.replace(/\{\{TITLE\}\}/g, projectName);
    writeFileSync(join(distDir, 'index.html'), html);
  }

  // 6. Report
  console.log('  [5/5] Done!');

  // Cleanup
  rmSync(stagingDir, { recursive: true, force: true });
  rmSync(loveStaging, { recursive: true, force: true });

  const files = readdirSync(distDir);
  console.log(`\n  Output: dist/web/ (${files.length} entries)`);
  for (const f of files) {
    const st = statSync(join(distDir, f));
    if (st.isDirectory()) {
      console.log(`    ${(f + '/').padEnd(20)} (dir)`);
    } else {
      const kb = st.size / 1024;
      const size = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(0) + ' KB';
      console.log(`    ${f.padEnd(20)} ${size}`);
    }
  }
  console.log(`\n  Serve: cd dist/web && python3 -m http.server\n`);
}

