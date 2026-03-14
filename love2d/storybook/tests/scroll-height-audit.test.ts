// Scroll height audit — detect massive-gap layout bugs.
//
// CRITICAL: Reproduces the user's exact flow:
//   1. Start window at FHD (maximized) — set ONCE, never touch again
//   2. Navigate through ALL stories at that fixed size
//   3. Measure scroll heights per story (no resize between stories!)
//   4. Second pass: shrink to 900x700, walk all stories again
//   5. Compare: stories whose FHD content height is wildly larger = the bug
//
// The resize itself fixes the layout, so we must NOT resize per-story.
//
// Run:
//   cd storybook && rjit build && rjit test tests/scroll-height-audit.test.ts --timeout=240
// Report:
//   cat /tmp/scroll-height-audit.txt

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

type ScrollContainer = {
  id: string;
  type: string;
  debugName: string;
  depth: number;
  x: number; y: number; w: number; h: number;
  contentW: number;
  contentH: number;
  ratio: number;
  overflow: string;
  flag?: string;
};

type ScrollHeightsResult = {
  vpW: number;
  vpH: number;
  containers: ScrollContainer[];
};

const bridge = (globalThis as any).__rjitBridge as RpcBridge | undefined;

function requireBridge(): RpcBridge {
  if (!bridge) throw new Error('Missing __rjitBridge');
  return bridge;
}

async function setViewport(w: number, h: number): Promise<void> {
  await requireBridge().rpc('window:setSize', { width: w, height: h });
  await page.wait(5);
}

async function writeFile(path: string, content: string): Promise<void> {
  await requireBridge().rpc('test:writeFile', { path, content });
}

// All story titles from storybook index, in order
const ALL_STORIES = [
  'Gallery', 'Hook Gallery', 'Box', 'Text', 'Layout', 'Style',
  'Image & Video', 'Image Gallery', 'Input', 'Monaco Mirror', 'Icons',
  'Navigation', 'Data', 'Windows', 'Animation', 'Classifier',
  'Networking', 'Crypto', 'Files', 'Effects', 'Masks', 'Time', 'Math',
  'Conversions', 'Spreadsheet', 'Privacy', 'Capabilities', 'Storage',
  'Audio', '3D', 'Geo', 'Presentation', 'Render',
  'Demos', 'NES Emulator', '3D Showcase', 'Map', 'GeoScene3D', 'Audio Rack',
  'Physics', 'Imaging', 'Capture',
  'Compatibility',
  'Stress Test Hub', 'Syntax Stress', 'Recording Stress',
  'TSL Boids', 'Cartridge Inspector', 'Error Test', 'Lint Test', 'DevTools',
  'Layout 1', 'Layout 2', 'Layout 3', 'Overflow Compare',
  'Overlay', 'CreativeConcepts', 'AI', 'Finance', 'Chemistry',
];

type PassResult = {
  title: string;
  navigated: boolean;
  vpW: number;
  vpH: number;
  containers: ScrollContainer[];
  maxRatio: number;
  totalContentH: number;
};

async function navigateAndMeasure(title: string): Promise<PassResult> {
  // Click the story — do NOT resize, viewport is already set
  try {
    await page.find('Text', { children: title }).click();
    await page.wait(4);
  } catch {
    return { title, navigated: false, vpW: 0, vpH: 0, containers: [], maxRatio: 0, totalContentH: 0 };
  }

  const result = await requireBridge().rpc<ScrollHeightsResult>(
    'test:scroll-heights', {}, 5000
  );

  const containers = result?.containers || [];
  const maxRatio = containers.reduce(
    (max: number, c: ScrollContainer) => Math.max(max, c.ratio), 0
  );
  const totalContentH = containers.reduce(
    (sum: number, c: ScrollContainer) => sum + c.contentH, 0
  );

  return {
    title,
    navigated: true,
    vpW: result?.vpW || 0,
    vpH: result?.vpH || 0,
    containers,
    maxRatio,
    totalContentH,
  };
}

test('Scroll height audit — detect massive gaps at maximized window', async () => {
  const lines: string[] = [];
  const log = (s: string) => lines.push(s);

  log('SCROLL HEIGHT AUDIT — MASSIVE GAP DETECTION');
  log('='.repeat(100));
  log('');
  log('Pass 1: Set window to 1920x1080 ONCE, then walk ALL stories without resizing.');
  log('Pass 2: Set window to 900x700 ONCE, then walk ALL stories without resizing.');
  log('Compare: stories whose FHD content height is wildly larger than default = the bug.');
  log('');

  // ── Pass 1: FHD (maximized) ──
  log('--- PASS 1: 1920x1080 (FHD / maximized) ---');
  await setViewport(1920, 1080);

  const fhdResults: PassResult[] = [];
  for (const title of ALL_STORIES) {
    const r = await navigateAndMeasure(title);
    fhdResults.push(r);
  }

  // ── Pass 2: Default (windowed) ──
  log('--- PASS 2: 900x700 (default / windowed) ---');
  await setViewport(900, 700);

  const defResults: PassResult[] = [];
  for (const title of ALL_STORIES) {
    const r = await navigateAndMeasure(title);
    defResults.push(r);
  }

  // ── Summary table ──
  log('');
  log('Story'.padEnd(24) + '| FHD ratio | FHD contentH | Def ratio | Def contentH | Growth | Flag');
  log('-'.repeat(110));

  let flagCount = 0;

  for (let i = 0; i < ALL_STORIES.length; i++) {
    const fhd = fhdResults[i];
    const def = defResults[i];

    if (!fhd.navigated || !def.navigated) {
      log(`${ALL_STORIES[i].padEnd(23)} | SKIP`);
      continue;
    }

    const growth = def.totalContentH > 0
      ? (fhd.totalContentH / def.totalContentH).toFixed(1)
      : '?';

    const flag = fhd.maxRatio > 5 ? '<<< GAPS' :
                 fhd.maxRatio > 3 ? '< WARN' :
                 parseFloat(growth) > 3 ? '< GROWTH' : '';

    if (fhd.maxRatio > 5 || parseFloat(growth) > 3) flagCount++;

    log(
      `${fhd.title.padEnd(23)} | ` +
      `${String(fhd.maxRatio).padEnd(9)} | ` +
      `${String(Math.round(fhd.totalContentH)).padEnd(12)} | ` +
      `${String(def.maxRatio).padEnd(9)} | ` +
      `${String(Math.round(def.totalContentH)).padEnd(12)} | ` +
      `${String(growth + 'x').padEnd(6)} | ${flag}`
    );
  }

  log('');
  log(`Flagged: ${flagCount} stories`);

  // ── Detailed dump for flagged stories ──
  const flagged = fhdResults.filter((fhd, i) => {
    const def = defResults[i];
    if (!fhd.navigated || !def.navigated) return false;
    const growth = def.totalContentH > 0 ? fhd.totalContentH / def.totalContentH : 0;
    return fhd.maxRatio > 3 || growth > 3;
  });

  if (flagged.length > 0) {
    log('');
    log('DETAILED SCROLL CONTAINERS FOR FLAGGED STORIES');
    log('='.repeat(100));

    for (const fhd of flagged) {
      const defIdx = ALL_STORIES.indexOf(fhd.title);
      const def = defResults[defIdx];

      log('');
      log(`--- ${fhd.title} ---`);
      log(`  FHD (${fhd.vpW}x${fhd.vpH}):`);
      for (const c of fhd.containers) {
        const flagStr = c.flag ? ` [${c.flag}]` : '';
        log(`    ${(c.debugName || c.type).padEnd(20)} depth=${c.depth} ` +
            `rect=${c.w}x${Math.round(c.h)}@(${Math.round(c.x)},${Math.round(c.y)}) ` +
            `content=${Math.round(c.contentW)}x${Math.round(c.contentH)} ` +
            `ratio=${c.ratio} overflow=${c.overflow}${flagStr}`);
      }
      if (def) {
        log(`  Default (${def.vpW}x${def.vpH}):`);
        for (const c of def.containers) {
          const flagStr = c.flag ? ` [${c.flag}]` : '';
          log(`    ${(c.debugName || c.type).padEnd(20)} depth=${c.depth} ` +
              `rect=${c.w}x${Math.round(c.h)}@(${Math.round(c.x)},${Math.round(c.y)}) ` +
              `content=${Math.round(c.contentW)}x${Math.round(c.contentH)} ` +
              `ratio=${c.ratio} overflow=${c.overflow}${flagStr}`);
        }
      }
    }
  }

  const report = lines.join('\n');
  await writeFile('/tmp/scroll-height-audit.txt', report);

  // Always log where the report is
  log('');
  log('Report written to /tmp/scroll-height-audit.txt');

  if (flagCount > 0) {
    const names = flagged.slice(0, 5).map(r => r.title).join(', ');
    throw new Error(
      `${flagCount} stories flagged. ` +
      `Suspects: ${names}. Report: /tmp/scroll-height-audit.txt`
    );
  }
});
