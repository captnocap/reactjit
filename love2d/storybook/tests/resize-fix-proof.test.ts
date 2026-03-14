// Resize-fix proof — demonstrates that scroll heights change after a resize cycle.
//
// For each story:
//   1. Navigate to it (no resize)
//   2. Measure scroll heights ("before")
//   3. Resize down 1px then back up 1px (triggers ReactJIT.resize)
//   4. Measure scroll heights again ("after")
//   5. Report the diff
//
// If contentH drops dramatically after the resize cycle, the initial layout
// was wrong and the resize fixed it. This proves the bug.
//
// Run:
//   cd storybook && rjit build && rjit test tests/resize-fix-proof.test.ts --timeout=240
// Report:
//   cat /tmp/resize-fix-proof.txt

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

async function writeFile(path: string, content: string): Promise<void> {
  await requireBridge().rpc('test:writeFile', { path, content });
}

async function getScrollHeights(): Promise<ScrollHeightsResult> {
  return await requireBridge().rpc<ScrollHeightsResult>(
    'test:scroll-heights', {}, 5000
  );
}

// Resize by 1px down then back up — minimal cycle to trigger ReactJIT.resize()
async function resizeCycle(): Promise<void> {
  const before = await getScrollHeights();
  const w = before.vpW;
  const h = before.vpH;
  // Shrink 1px
  await requireBridge().rpc('window:setSize', { width: w - 1, height: h - 1 });
  await page.wait(3);
  // Restore
  await requireBridge().rpc('window:setSize', { width: w, height: h });
  await page.wait(3);
}

// Stories to test — focusing on known Layout 2 stories + some Layout 1 controls
const TEST_STORIES = [
  // Layout 2 (Band/Half) — expected to show the bug
  'Windows', 'Animation', 'Crypto', 'Files', 'Networking',
  'Audio', '3D', 'Geo', 'Render', 'Overlay',
  'AI', 'Finance', 'Chemistry', 'Capabilities',
  // Layout 1 (StoryPage/StorySection) — control group, should be clean
  'Gallery', 'Box', 'Text', 'Input', 'Icons',
  'Effects', 'Masks', 'Classifier', 'Spreadsheet',
];

test('Resize-fix proof — before/after resize comparison', async () => {
  const lines: string[] = [];
  const log = (s: string) => lines.push(s);

  log('RESIZE-FIX PROOF — BEFORE/AFTER COMPARISON');
  log('='.repeat(110));
  log('');
  log('Each story is measured BEFORE and AFTER a 1px resize cycle.');
  log('If contentH drops dramatically after resize, the initial layout was wrong.');
  log('');

  // Set viewport once — stay at this size throughout
  await requireBridge().rpc('window:setSize', { width: 1200, height: 800 });
  await page.wait(5);

  type StoryResult = {
    title: string;
    navigated: boolean;
    before: { maxRatio: number; totalContentH: number; containers: ScrollContainer[] };
    after: { maxRatio: number; totalContentH: number; containers: ScrollContainer[] };
    diff: number;
    diffPct: string;
  };

  const results: StoryResult[] = [];

  for (const title of TEST_STORIES) {
    // Navigate WITHOUT resizing
    try {
      await page.find('Text', { children: title }).click();
      await page.wait(4);
    } catch {
      results.push({
        title,
        navigated: false,
        before: { maxRatio: 0, totalContentH: 0, containers: [] },
        after: { maxRatio: 0, totalContentH: 0, containers: [] },
        diff: 0,
        diffPct: '?',
      });
      continue;
    }

    // Measure BEFORE resize
    const beforeResult = await getScrollHeights();
    const beforeContainers = beforeResult?.containers || [];
    const beforeMaxRatio = beforeContainers.reduce(
      (max: number, c: ScrollContainer) => Math.max(max, c.ratio), 0
    );
    const beforeTotalH = beforeContainers.reduce(
      (sum: number, c: ScrollContainer) => sum + c.contentH, 0
    );

    // Resize cycle: shrink 1px, restore
    await resizeCycle();

    // Measure AFTER resize
    const afterResult = await getScrollHeights();
    const afterContainers = afterResult?.containers || [];
    const afterMaxRatio = afterContainers.reduce(
      (max: number, c: ScrollContainer) => Math.max(max, c.ratio), 0
    );
    const afterTotalH = afterContainers.reduce(
      (sum: number, c: ScrollContainer) => sum + c.contentH, 0
    );

    const diff = beforeTotalH - afterTotalH;
    const diffPct = afterTotalH > 0
      ? ((diff / afterTotalH) * 100).toFixed(1) + '%'
      : diff > 0 ? 'INF' : '0%';

    results.push({
      title,
      navigated: true,
      before: { maxRatio: beforeMaxRatio, totalContentH: beforeTotalH, containers: beforeContainers },
      after: { maxRatio: afterMaxRatio, totalContentH: afterTotalH, containers: afterContainers },
      diff: Math.round(diff),
      diffPct,
    });
  }

  // ── Summary table ──
  log('Story'.padEnd(20) + '| Before ratio | Before H  | After ratio | After H   | Diff (px) | Diff %   | Verdict');
  log('-'.repeat(110));

  let bugCount = 0;
  for (const r of results) {
    if (!r.navigated) {
      log(`${r.title.padEnd(19)} | SKIP (nav failed)`);
      continue;
    }

    const isBug = r.diff > 1000;
    if (isBug) bugCount++;
    const verdict = isBug ? '<<< BUG' : r.diff > 100 ? '< minor' : 'OK';

    log(
      `${r.title.padEnd(19)} | ` +
      `${String(r.before.maxRatio).padEnd(11)} | ` +
      `${String(Math.round(r.before.totalContentH)).padEnd(9)} | ` +
      `${String(r.after.maxRatio).padEnd(11)} | ` +
      `${String(Math.round(r.after.totalContentH)).padEnd(9)} | ` +
      `${String(r.diff).padEnd(9)} | ` +
      `${r.diffPct.padEnd(8)} | ${verdict}`
    );
  }

  log('');
  log(`Stories with resize-fix bug: ${bugCount}`);

  // ── Per-container diff for bugs ──
  const bugs = results.filter(r => r.navigated && r.diff > 1000);
  if (bugs.length > 0) {
    log('');
    log('PER-CONTAINER DIFF FOR AFFECTED STORIES');
    log('='.repeat(110));

    for (const r of bugs) {
      log('');
      log(`--- ${r.title} ---`);

      // Match containers by depth+overflow for before/after comparison
      const maxLen = Math.max(r.before.containers.length, r.after.containers.length);
      for (let i = 0; i < maxLen; i++) {
        const b = r.before.containers[i];
        const a = r.after.containers[i];

        if (b && a) {
          const hDiff = Math.round(b.contentH - a.contentH);
          const marker = Math.abs(hDiff) > 100 ? ' <<<' : '';
          log(
            `  ${(b.debugName || b.type).padEnd(20)} ` +
            `before: ${b.w}x${Math.round(b.h)} content=${Math.round(b.contentH)}  →  ` +
            `after: ${a.w}x${Math.round(a.h)} content=${Math.round(a.contentH)}  ` +
            `diff=${hDiff}${marker}`
          );
        } else if (b) {
          log(`  ${(b.debugName || b.type).padEnd(20)} before: ${b.w}x${Math.round(b.h)} content=${Math.round(b.contentH)}  →  GONE`);
        } else if (a) {
          log(`  ${(a.debugName || a.type).padEnd(20)} NEW  →  after: ${a.w}x${Math.round(a.h)} content=${Math.round(a.contentH)}`);
        }
      }
    }
  }

  const report = lines.join('\n');
  await writeFile('/tmp/resize-fix-proof.txt', report);

  if (bugCount > 0) {
    const names = bugs.map(r => r.title).join(', ');
    throw new Error(
      `${bugCount} stories have resize-fix bug. ` +
      `Affected: ${names}. Report: /tmp/resize-fix-proof.txt`
    );
  }
});
