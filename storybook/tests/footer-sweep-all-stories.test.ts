// Footer visibility sweep — all stories.
//
// Navigates to each story, resizes to problematic viewports, and uses
// test:audit to check for off-viewport violations. Reports which stories
// have elements pushed below the viewport.
//
// Run:
//   cd storybook && rjit build && rjit test tests/footer-sweep-all-stories.test.ts --timeout=180
// Report:
//   cat /tmp/footer-sweep-report.txt

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

type AuditViolation = {
  rule: string;
  severity: string;
  message: string;
};

const bridge = (globalThis as any).__rjitBridge as RpcBridge | undefined;

function requireBridge(): RpcBridge {
  if (!bridge) throw new Error('Missing __rjitBridge');
  return bridge;
}

async function setViewport(w: number, h: number): Promise<void> {
  await requireBridge().rpc('window:setSize', { width: w, height: h });
  await page.wait(3);
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
  'Audio', '3D', 'Render',
  'Demos', 'NES Emulator', '3D Showcase', 'Map', 'GeoScene3D', 'Audio Rack',
  'Physics', 'Imaging', 'Capture',
  'Compatibility',
  'Stress Test Hub', 'Syntax Stress', 'Recording Stress',
  'TSL Boids', 'Cartridge Inspector', 'Error Test', 'Lint Test', 'DevTools',
  'Layout 1', 'Layout 2', 'Layout 3', 'Overflow Compare',
  'Overlay', 'CreativeConcepts', 'AI', 'Finance', 'Chemistry',
];

// Viewports that caused overflow for the Gallery story
const TEST_VIEWPORTS = [
  { w: 800,  h: 600, label: '800x600'  },
  { w: 1024, h: 768, label: '1024x768' },
  { w: 1280, h: 720, label: '1280x720' },
];

async function navigateToStory(title: string): Promise<boolean> {
  // Set large viewport so sidebar items are visible
  await setViewport(1440, 960);
  try {
    await page.find('Text', { children: title }).click();
    await page.wait(4);
    return true;
  } catch {
    return false;
  }
}

test('Footer visibility sweep — all stories', async () => {
  const lines: string[] = [];
  const log = (s: string) => lines.push(s);

  log('FOOTER VISIBILITY SWEEP — ALL STORIES');
  log('='.repeat(90));
  log('');
  log('For each story, resizes to 800x600, 1024x768, 1280x720 and runs layout audit.');
  log('Reports off-viewport violations (elements pushed below the visible area).');
  log('');

  type StoryResult = {
    title: string;
    navigated: boolean;
    viewports: Array<{
      label: string;
      offViewport: AuditViolation[];
      childOverflow: AuditViolation[];
    }>;
  };

  const results: StoryResult[] = [];
  let passCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (const title of ALL_STORIES) {
    const ok = await navigateToStory(title);
    if (!ok) {
      results.push({ title, navigated: false, viewports: [] });
      skipCount++;
      continue;
    }

    const viewports: StoryResult['viewports'] = [];
    let storyHasIssues = false;

    for (const vp of TEST_VIEWPORTS) {
      await setViewport(vp.w, vp.h);

      const audit = await page.audit();
      const violations = (audit.violations || []) as AuditViolation[];

      const offViewport = violations.filter(v => v.rule === 'off-viewport');
      const childOverflow = violations.filter(v => v.rule === 'child-overflow');

      viewports.push({ label: vp.label, offViewport, childOverflow });
      if (offViewport.length > 0) storyHasIssues = true;
    }

    results.push({ title, navigated: true, viewports });
    if (storyHasIssues) failCount++;
    else passCount++;
  }

  // ── Report ──
  log('Story'.padEnd(24) + '| ' + TEST_VIEWPORTS.map(v => v.label.padEnd(14)).join('| ') + '| Status');
  log('-'.repeat(90));

  for (const r of results) {
    if (!r.navigated) {
      log(`${r.title.padEnd(23)} | ${'SKIP (nav fail)'.padEnd(44)} | SKIP`);
      continue;
    }

    const vpResults = r.viewports.map(v => {
      const offCount = v.offViewport.length;
      const overCount = v.childOverflow.length;
      if (offCount > 0) return `OFF:${offCount}`.padEnd(13);
      if (overCount > 0) return `over:${overCount}`.padEnd(13);
      return 'OK'.padEnd(13);
    });

    const hasOff = r.viewports.some(v => v.offViewport.length > 0);
    const status = hasOff ? 'FAIL <<<' : 'OK';
    log(`${r.title.padEnd(23)} | ${vpResults.join('| ')} | ${status}`);
  }

  log('');
  log(`Summary: ${passCount} pass, ${failCount} fail, ${skipCount} skip`);

  // ── Detail for failures ──
  const failures = results.filter(r => r.navigated && r.viewports.some(v => v.offViewport.length > 0));
  if (failures.length > 0) {
    log('');
    log('OFF-VIEWPORT DETAILS');
    log('='.repeat(90));

    for (const r of failures) {
      log('');
      log(`--- ${r.title} ---`);
      for (const v of r.viewports) {
        if (v.offViewport.length === 0) continue;
        log(`  ${v.label}:`);
        for (const viol of v.offViewport.slice(0, 5)) {
          log(`    [${viol.severity}] ${viol.message}`);
        }
        if (v.offViewport.length > 5) log(`    (+${v.offViewport.length - 5} more)`);
      }
    }
  }

  const report = lines.join('\n');
  await writeFile('/tmp/footer-sweep-report.txt', report);

  // Summary for test runner
  if (failCount > 0) {
    const failNames = failures.slice(0, 5).map(r => r.title).join(', ');
    throw new Error(
      `${passCount} pass, ${failCount} fail, ${skipCount} skip. ` +
      `Failures: ${failNames}. Report: /tmp/footer-sweep-report.txt`
    );
  }
});
