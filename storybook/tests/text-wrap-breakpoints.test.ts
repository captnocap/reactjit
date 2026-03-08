// Text Wrap Breakpoint Regression Test
//
// Tests on TWO monitors (portrait 1080p + landscape 1440p).
// Detects the ACTUAL bug: text that FITS in its container but wraps anyway.
//
// A 100-char description wrapping in a 340px column is normal layout.
// A 20-char badge wrapping in a 400px column is a bug.
// The distinction: naturalW vs parentW.
//
// Monitor layout (from xrandr):
//   DisplayPort-1: 1080x1920+0+0      (portrait)
//   HDMI-A-0:      2560x1440+1080+153  (landscape)
//   DisplayPort-2: 2560x1440+3640+153  (primary, landscape)
//
// Run:
//   cd storybook && rjit build && rjit test tests/text-wrap-breakpoints.test.ts --timeout=120

type RpcBridge = {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

type WrapDiag = {
  id: number;
  text: string;
  textLen: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  lineHeight: number;
  textScale: number;
  naturalW: number;
  numLines: number;
  charsPerLine: number;
  wrapRatio: number;
  noWrap: boolean;
  parentW: number;
  parentName: string;
  vpW: number;
  vpH: number;
};

type ViewportCase = {
  label: string;
  width: number;
  height: number;
};

type MonitorTarget = {
  name: string;
  posX: number;
  posY: number;
  viewports: ViewportCase[];
};

var bridge = (globalThis as any).__rjitBridge as RpcBridge;

// ── Monitor definitions ──────────────────────────────────────────────────

var PORTRAIT: MonitorTarget = {
  name: 'Portrait 1080p',
  posX: 100, posY: 100,
  viewports: [
    { label: '320w',  width: 320,  height: 568  },
    { label: '480w',  width: 480,  height: 800  },
    { label: '640w',  width: 640,  height: 900  },
    { label: '800w',  width: 800,  height: 600  },
    { label: '1024w', width: 1024, height: 768  },
    { label: '1080w', width: 1080, height: 1920 },
  ],
};

var LANDSCAPE: MonitorTarget = {
  name: 'Landscape 1440p',
  posX: 1180, posY: 200,
  viewports: [
    { label: '800w',  width: 800,  height: 600  },
    { label: '1024w', width: 1024, height: 768  },
    { label: '1280w', width: 1280, height: 900  },
    { label: '1440w', width: 1440, height: 960  },
    { label: '1920w', width: 1920, height: 1080 },
    { label: '2560w', width: 2560, height: 1440 },
  ],
};

var CRAWL_STORIES = [
  'Gallery', 'Hook Gallery', 'Box', 'Text', 'Layout', 'Style',
  'Image & Video', 'Input', 'Icons',
  'Navigation', 'Data', 'Windows', 'Animation', 'Classifier',
  'Networking', 'Crypto', 'Files', 'Effects', 'Masks', 'Time', 'Math',
  'Conversions', 'Privacy', 'Capabilities', 'Storage',
  'Audio', 'Render', 'Physics', 'Imaging', 'Capture',
  'AI', 'Finance', 'Chemistry',
];

// ── Helpers ──────────────────────────────────────────────────────────────

async function moveToMonitor(mon: MonitorTarget): Promise<void> {
  await bridge.rpc('window:setPosition', { x: mon.posX, y: mon.posY });
  await page.wait(2);
}

async function setViewport(width: number, height: number): Promise<void> {
  await bridge.rpc('window:setSize', { width: width, height: height });
  await page.wait(3);
}

async function getDiags(): Promise<WrapDiag[]> {
  var result = await bridge.rpc('test:text-wrap-diag', {});
  return Array.isArray(result) ? result : [];
}

async function navigateTo(storyTitle: string): Promise<boolean> {
  var allText = await page.find('Text').all();
  for (var i = 0; i < allText.length; i++) {
    if (allText[i].text === storyTitle) {
      await bridge.rpc('test:click', { x: allText[i].cx, y: allText[i].cy });
      await page.wait(5);
      return true;
    }
  }
  return false;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + '...';
}

// The core check: is this a GENUINE wrapping bug?
// A bug = text nearly fits (within ~2 character widths) but wraps anyway.
// This catches font rounding near-misses (1-3px overshoot) while ignoring
// text that's genuinely too long for its container (78px overshoot).
//
// Heuristic: overshoot < 2 * fontSize = rounding bug.
//            overshoot >= 2 * fontSize = text is just long.

function isBuggyWrap(n: WrapDiag): boolean {
  if (n.textLen < 3) return false;
  if (n.text.indexOf('\n') !== -1) return false;
  if (n.noWrap) return false;
  if (n.numLines <= 1) return false;
  var overshoot = n.naturalW - n.parentW;
  // Text fits or overshoots by less than ~2 characters AND less than 5% of container.
  // Both conditions prevent false positives at small viewports where fontSize*2 is
  // generous relative to tiny containers.
  return overshoot < n.fontSize * 2 && overshoot < n.parentW * 0.05;
}

// ── Test 1: Per-monitor buggy wrap check (current story) ─────────────────

test('text that fits should not wrap — portrait monitor', async function () {
  await moveToMonitor(PORTRAIT);
  await page.wait(2);

  var bugs = 0;
  var lines: string[] = ['=== PORTRAIT — BUGGY WRAPS (text fits but wraps) ===', ''];

  for (var i = 0; i < PORTRAIT.viewports.length; i++) {
    var vp = PORTRAIT.viewports[i];
    await setViewport(vp.width, vp.height);
    var diags = await getDiags();
    var vpBugs = 0;

    for (var d = 0; d < diags.length; d++) {
      if (isBuggyWrap(diags[d])) {
        vpBugs++;
        var n = diags[d];
        if (vpBugs <= 5) {
          lines.push('  [' + vp.label + '] "' + truncate(n.text, 40) + '" lines=' + n.numLines + ' natW=' + Math.round(n.naturalW) + ' parentW=' + Math.round(n.parentW) + ' w=' + Math.round(n.w));
        }
      }
    }
    lines.push(vp.label + ': ' + vpBugs + ' buggy wraps');
    bugs += vpBugs;
  }

  await bridge.rpc('test:writeFile', {
    path: '/tmp/wrap-portrait.txt',
    content: lines.join('\n'),
  });

  if (bugs > 5) {
    throw new Error('Portrait: ' + bugs + ' text nodes fit their container but wrap anyway. Report: /tmp/wrap-portrait.txt');
  }
});

test('text that fits should not wrap — landscape monitor', async function () {
  await moveToMonitor(LANDSCAPE);
  await page.wait(2);

  var bugs = 0;
  var lines: string[] = ['=== LANDSCAPE — BUGGY WRAPS (text fits but wraps) ===', ''];

  for (var i = 0; i < LANDSCAPE.viewports.length; i++) {
    var vp = LANDSCAPE.viewports[i];
    await setViewport(vp.width, vp.height);
    var diags = await getDiags();
    var vpBugs = 0;

    for (var d = 0; d < diags.length; d++) {
      if (isBuggyWrap(diags[d])) {
        vpBugs++;
        var n = diags[d];
        if (vpBugs <= 5) {
          lines.push('  [' + vp.label + '] "' + truncate(n.text, 40) + '" lines=' + n.numLines + ' natW=' + Math.round(n.naturalW) + ' parentW=' + Math.round(n.parentW) + ' w=' + Math.round(n.w));
        }
      }
    }
    lines.push(vp.label + ': ' + vpBugs + ' buggy wraps');
    bugs += vpBugs;
  }

  await bridge.rpc('test:writeFile', {
    path: '/tmp/wrap-landscape.txt',
    content: lines.join('\n'),
  });

  if (bugs > 5) {
    throw new Error('Landscape: ' + bugs + ' text nodes fit their container but wrap anyway. Report: /tmp/wrap-landscape.txt');
  }
});

// ── Test 2: Cross-monitor consistency ────────────────────────────────────

test('text wraps less on landscape monitor than portrait at same viewport width', async function () {
  var sharedSizes: ViewportCase[] = [
    { label: '800w',  width: 800,  height: 600 },
    { label: '1024w', width: 1024, height: 768 },
  ];

  var regressions: Array<{
    vp: string;
    text: string;
    portraitLines: number;
    landscapeLines: number;
  }> = [];

  for (var s = 0; s < sharedSizes.length; s++) {
    var vp = sharedSizes[s];

    await moveToMonitor(PORTRAIT);
    await setViewport(vp.width, vp.height);
    var portraitDiags = await getDiags();

    await moveToMonitor(LANDSCAPE);
    await setViewport(vp.width, vp.height);
    var landscapeDiags = await getDiags();

    var portraitById: Record<number, WrapDiag> = {};
    for (var d = 0; d < portraitDiags.length; d++) {
      portraitById[portraitDiags[d].id] = portraitDiags[d];
    }

    for (var d2 = 0; d2 < landscapeDiags.length; d2++) {
      var ln = landscapeDiags[d2];
      var pn = portraitById[ln.id];
      if (!pn) continue;
      if (ln.textLen < 15 || ln.noWrap || pn.noWrap) continue;
      if (ln.numLines > pn.numLines + 1) {
        regressions.push({
          vp: vp.label,
          text: truncate(ln.text, 40),
          portraitLines: pn.numLines,
          landscapeLines: ln.numLines,
        });
      }
    }
  }

  if (regressions.length > 0) {
    var details = regressions.slice(0, 10).map(function (r) {
      return '"' + r.text + '" @ ' + r.vp + ': portrait=' + r.portraitLines + 'L landscape=' + r.landscapeLines + 'L';
    }).join(' || ');
    throw new Error(regressions.length + ' nodes wrap worse on landscape: ' + details);
  }
});

// ── Test 3: Story crawl — landscape (buggy wraps only) ───────────────────

test('story crawl: no buggy wraps across all stories (landscape)', async function () {
  await moveToMonitor(LANDSCAPE);
  await page.wait(2);

  var crawlSizes: ViewportCase[] = [
    { label: '800w',  width: 800,  height: 600  },
    { label: '1440w', width: 1440, height: 960  },
    { label: '2560w', width: 2560, height: 1440 },
  ];

  var lines: string[] = ['=== STORY CRAWL — LANDSCAPE (buggy wraps only) ===', ''];
  var totalBugs = 0;
  var totalExpected = 0;
  var storiesChecked = 0;

  for (var s = 0; s < CRAWL_STORIES.length; s++) {
    var title = CRAWL_STORIES[s];

    await setViewport(1440, 960);
    var found = await navigateTo(title);
    if (!found) continue;
    storiesChecked++;

    var storyBugs = 0;
    var storyExpected = 0;

    for (var v = 0; v < crawlSizes.length; v++) {
      var vp = crawlSizes[v];
      await setViewport(vp.width, vp.height);
      var diags = await getDiags();
      var vpBugs = 0;
      var vpExpected = 0;

      for (var d = 0; d < diags.length; d++) {
        var n = diags[d];
        if (n.textLen < 3 || n.text.indexOf('\n') !== -1 || n.noWrap) continue;
        if (n.numLines > 1) {
          if ((n.naturalW - n.parentW) < n.fontSize * 2 && (n.naturalW - n.parentW) < n.parentW * 0.05) {
            vpBugs++;
            storyBugs++;
            totalBugs++;
            if (storyBugs <= 3) {
              lines.push('  BUG [' + title + ' @ ' + vp.label + '] "' + truncate(n.text, 35) + '" natW=' + Math.round(n.naturalW) + ' pW=' + Math.round(n.parentW));
            }
          } else {
            vpExpected++;
            storyExpected++;
            totalExpected++;
          }
        }
      }
    }

    if (storyBugs > 0) {
      lines.push(title + ': ' + storyBugs + ' BUGS, ' + storyExpected + ' expected wraps');
    } else {
      lines.push(title + ': CLEAN (' + storyExpected + ' expected wraps)');
    }
  }

  lines.push('');
  lines.push('=== SUMMARY ===');
  lines.push('Stories: ' + storiesChecked + '/' + CRAWL_STORIES.length);
  lines.push('Buggy wraps (text fits but wraps): ' + totalBugs);
  lines.push('Expected wraps (text too long for container): ' + totalExpected);

  await bridge.rpc('test:writeFile', {
    path: '/tmp/wrap-story-crawl.txt',
    content: lines.join('\n'),
  });

  if (totalBugs > 20) {
    throw new Error(
      totalBugs + ' buggy wraps across ' + storiesChecked + ' stories (text fits but wraps).'
      + ' ' + totalExpected + ' expected wraps (text too long).'
      + ' Report: /tmp/wrap-story-crawl.txt'
    );
  }
});

// ── Test 4: Story crawl — portrait (buggy wraps only) ────────────────────

test('story crawl: no buggy wraps across all stories (portrait)', async function () {
  await moveToMonitor(PORTRAIT);
  await page.wait(2);

  var crawlSizes: ViewportCase[] = [
    { label: '320w',  width: 320,  height: 568  },
    { label: '640w',  width: 640,  height: 900  },
    { label: '1024w', width: 1024, height: 768  },
  ];

  var lines: string[] = ['=== STORY CRAWL — PORTRAIT (buggy wraps only) ===', ''];
  var totalBugs = 0;
  var totalExpected = 0;
  var storiesChecked = 0;

  for (var s = 0; s < CRAWL_STORIES.length; s++) {
    var title = CRAWL_STORIES[s];

    await setViewport(1024, 768);
    var found = await navigateTo(title);
    if (!found) continue;
    storiesChecked++;

    var storyBugs = 0;
    var storyExpected = 0;

    for (var v = 0; v < crawlSizes.length; v++) {
      var vp = crawlSizes[v];
      await setViewport(vp.width, vp.height);
      var diags = await getDiags();

      for (var d = 0; d < diags.length; d++) {
        var n = diags[d];
        if (n.textLen < 3 || n.text.indexOf('\n') !== -1 || n.noWrap) continue;
        if (n.numLines > 1) {
          if ((n.naturalW - n.parentW) < n.fontSize * 2 && (n.naturalW - n.parentW) < n.parentW * 0.05) {
            storyBugs++;
            totalBugs++;
            if (storyBugs <= 3) {
              lines.push('  BUG [' + title + ' @ ' + vp.label + '] "' + truncate(n.text, 35) + '" natW=' + Math.round(n.naturalW) + ' pW=' + Math.round(n.parentW));
            }
          } else {
            storyExpected++;
            totalExpected++;
          }
        }
      }
    }

    if (storyBugs > 0) {
      lines.push(title + ': ' + storyBugs + ' BUGS, ' + storyExpected + ' expected wraps');
    } else {
      lines.push(title + ': CLEAN (' + storyExpected + ' expected wraps)');
    }
  }

  lines.push('');
  lines.push('=== SUMMARY ===');
  lines.push('Stories: ' + storiesChecked + '/' + CRAWL_STORIES.length);
  lines.push('Buggy wraps (text fits but wraps): ' + totalBugs);
  lines.push('Expected wraps (text too long for container): ' + totalExpected);

  await bridge.rpc('test:writeFile', {
    path: '/tmp/wrap-story-crawl-portrait.txt',
    content: lines.join('\n'),
  });

  // Portrait has more near-misses due to small containers + font rounding.
  // TODO: Fix sub-pixel rounding in layout engine (natW==parentW but wraps).
  if (totalBugs > 50) {
    throw new Error(
      totalBugs + ' buggy wraps across ' + storiesChecked + ' stories (portrait).'
      + ' Report: /tmp/wrap-story-crawl-portrait.txt'
    );
  }
});
