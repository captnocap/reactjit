// Text Wrap Breakpoint Regression Test
//
// Sweeps viewport sizes and detects pathological text wrapping:
//   1. Text nodes whose width SHRINKS as viewport grows (inverted sizing)
//   2. Text nodes where chars-per-line DROPS at larger viewports (wraps more)
//   3. Text nodes with absurdly narrow allocation at large viewports
//
// The invariant: text should wrap LESS at larger viewports, never MORE.
// This test catches the bug where "the bigger the window gets, the more
// text wraps nearly every few letters."
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

type WrapRegression = {
  text: string;
  nodeId: number;
  smallVp: string;
  largeVp: string;
  smallCPL: number;
  largeCPL: number;
  smallW: number;
  largeW: number;
  smallFS: number;
  largeFS: number;
  parentName: string;
};

type NarrowNode = {
  text: string;
  nodeId: number;
  viewport: string;
  w: number;
  charsPerLine: number;
  fontSize: number;
  parentName: string;
};

var bridge = (globalThis as any).__rjitBridge as RpcBridge;

// Viewport sweep — covers mobile through 4K
// We use the same sizes as breakpoint-rendering.test.ts SCALE_SNAPSHOTS
// plus a few extras to catch transition zones
var VIEWPORT_SWEEP: ViewportCase[] = [
  { label: '320w',  width: 320,  height: 568  },
  { label: '640w',  width: 640,  height: 900  },
  { label: '800w',  width: 800,  height: 600  },
  { label: '1024w', width: 1024, height: 768  },
  { label: '1280w', width: 1280, height: 900  },
  { label: '1440w', width: 1440, height: 960  },
  { label: '1920w', width: 1920, height: 1080 },
  { label: '2560w', width: 2560, height: 1440 },
  { label: '3840w', width: 3840, height: 2160 },
];

// Text-heavy stories for breakpoint transition checks (test 3)
var TRANSITION_STORIES = [
  'Gallery', 'Text', 'Layout', 'Style', 'Navigation', 'Data',
];

// All stories for the diagnostic dump (test 5)
var ALL_STORIES = [
  'Gallery', 'Hook Gallery', 'Box', 'Text', 'Layout', 'Style',
  'Image & Video', 'Input', 'Icons',
  'Navigation', 'Data', 'Windows', 'Animation', 'Classifier',
  'Networking', 'Crypto', 'Files', 'Effects', 'Masks', 'Time', 'Math',
  'Conversions', 'Privacy', 'Capabilities', 'Storage',
  'Audio', 'Render', 'Physics', 'Imaging', 'Capture',
  'AI', 'Finance', 'Chemistry',
];

// Minimum text length to bother checking (short labels don't wrap meaningfully)
var MIN_TEXT_LEN = 15;

// Chars-per-line threshold: below this, text is pathologically squeezed
var PATHOLOGICAL_CPL = 4;

// Regression threshold: if chars-per-line drops by more than this factor
// from a smaller viewport to a larger one, it's a regression
var CPL_REGRESSION_FACTOR = 0.6;

async function setViewport(width: number, height: number): Promise<void> {
  await bridge.rpc('window:setSize', { width: width, height: height });
  await page.wait(3);
}

async function getWrapDiagnostics(): Promise<WrapDiag[]> {
  var result = await bridge.rpc('test:text-wrap-diag', {});
  if (!result || !Array.isArray(result)) return [];
  return result;
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
  if (s.length <= max) return s;
  return s.slice(0, max) + '...';
}

// ── Test 1: Sweep current view for wrap regressions ─────────────────────

test('text wrapping does not regress as viewport grows', async function () {
  await page.wait(3);

  // Collect wrap diagnostics at each viewport size
  var snapshots: Array<{ vp: ViewportCase; diags: WrapDiag[] }> = [];

  for (var v = 0; v < VIEWPORT_SWEEP.length; v++) {
    var vp = VIEWPORT_SWEEP[v];
    await setViewport(vp.width, vp.height);
    var diags = await getWrapDiagnostics();
    snapshots.push({ vp: vp, diags: diags });
  }

  // Build per-node history: track metrics across viewport sizes
  // Match nodes by ID (stable across resizes within the same React mount)
  var regressions: WrapRegression[] = [];

  // For each pair of viewports (smaller, larger), check if any text node
  // wraps MORE at the larger viewport
  for (var s = 0; s < snapshots.length; s++) {
    for (var l = s + 1; l < snapshots.length; l++) {
      var small = snapshots[s];
      var large = snapshots[l];

      // Build lookup by node ID for the larger viewport
      var largeById: Record<number, WrapDiag> = {};
      for (var d = 0; d < large.diags.length; d++) {
        largeById[large.diags[d].id] = large.diags[d];
      }

      for (var d2 = 0; d2 < small.diags.length; d2++) {
        var smallNode = small.diags[d2];
        var largeNode = largeById[smallNode.id];

        // Skip if node not present at both sizes, too short, or noWrap
        if (!largeNode) continue;
        if (smallNode.textLen < MIN_TEXT_LEN) continue;
        if (smallNode.noWrap || largeNode.noWrap) continue;

        // Skip single-line text (no wrapping at either size)
        if (smallNode.numLines <= 1 && largeNode.numLines <= 1) continue;

        // The core check: chars-per-line should NOT drop significantly
        // at a larger viewport. Account for font scaling: if fontSize
        // grew by 2x, the same container width gives half the chars.
        // So normalize by fontSize ratio.
        var fontRatio = largeNode.fontSize / Math.max(1, smallNode.fontSize);
        var normalizedLargeCPL = largeNode.charsPerLine * fontRatio;

        if (smallNode.charsPerLine > 0 &&
            normalizedLargeCPL < smallNode.charsPerLine * CPL_REGRESSION_FACTOR) {
          regressions.push({
            text: truncate(smallNode.text, 40),
            nodeId: smallNode.id,
            smallVp: small.vp.label,
            largeVp: large.vp.label,
            smallCPL: smallNode.charsPerLine,
            largeCPL: largeNode.charsPerLine,
            smallW: Math.round(smallNode.w),
            largeW: Math.round(largeNode.w),
            smallFS: smallNode.fontSize,
            largeFS: largeNode.fontSize,
            parentName: largeNode.parentName,
          });
        }
      }
    }
  }

  // Deduplicate: keep only worst regression per node ID
  var worstById: Record<number, WrapRegression> = {};
  for (var r = 0; r < regressions.length; r++) {
    var reg = regressions[r];
    var existing = worstById[reg.nodeId];
    if (!existing || reg.largeCPL < existing.largeCPL) {
      worstById[reg.nodeId] = reg;
    }
  }

  var unique = Object.values(worstById);
  if (unique.length > 0) {
    // Sort by severity (lowest CPL = worst)
    unique.sort(function (a: WrapRegression, b: WrapRegression) {
      return a.largeCPL - b.largeCPL;
    });

    var details = unique.slice(0, 15).map(function (r: WrapRegression) {
      return '  "' + r.text + '" (parent=' + r.parentName + ')'
        + ' | ' + r.smallVp + ': ' + r.smallCPL + ' cpl @ w=' + r.smallW + ' fs=' + r.smallFS
        + ' → ' + r.largeVp + ': ' + r.largeCPL + ' cpl @ w=' + r.largeW + ' fs=' + r.largeFS;
    }).join(' || ');

    throw new Error(
      unique.length + ' text node(s) wrap MORE at larger viewports: ' + details
    );
  }
});

// ── Test 2: Detect pathologically narrow text at large viewports ─────────

test('no pathologically narrow text at large viewports', async function () {
  // Check at a few large viewports
  var largeSizes: ViewportCase[] = [
    { label: '1440w', width: 1440, height: 960 },
    { label: '1920w', width: 1920, height: 1080 },
    { label: '3840w', width: 3840, height: 2160 },
  ];

  var pathological: NarrowNode[] = [];

  for (var v = 0; v < largeSizes.length; v++) {
    var vp = largeSizes[v];
    await setViewport(vp.width, vp.height);
    var diags = await getWrapDiagnostics();

    for (var d = 0; d < diags.length; d++) {
      var node = diags[d];
      if (node.textLen < MIN_TEXT_LEN) continue;
      if (node.noWrap) continue;

      // Flag text nodes where chars-per-line is absurdly low
      if (node.charsPerLine <= PATHOLOGICAL_CPL && node.numLines > 2) {
        pathological.push({
          text: truncate(node.text, 40),
          nodeId: node.id,
          viewport: vp.label,
          w: Math.round(node.w),
          charsPerLine: node.charsPerLine,
          fontSize: node.fontSize,
          parentName: node.parentName,
        });
      }
    }
  }

  // Deduplicate by node ID (keep worst viewport)
  var worstById: Record<number, NarrowNode> = {};
  for (var p = 0; p < pathological.length; p++) {
    var item = pathological[p];
    var existing = worstById[item.nodeId];
    if (!existing || item.charsPerLine < existing.charsPerLine) {
      worstById[item.nodeId] = item;
    }
  }

  var unique = Object.values(worstById);
  if (unique.length > 0) {
    unique.sort(function (a: NarrowNode, b: NarrowNode) {
      return a.charsPerLine - b.charsPerLine;
    });

    var details = unique.slice(0, 15).map(function (n: NarrowNode) {
      return '  "' + n.text + '" @ ' + n.viewport
        + ' (parent=' + n.parentName + ')'
        + ' w=' + n.w + 'px, ' + n.charsPerLine + ' cpl, fs=' + n.fontSize;
    }).join(' || ');

    throw new Error(
      unique.length + ' text node(s) with pathological wrapping (≤' + PATHOLOGICAL_CPL + ' chars/line): ' + details
    );
  }
});

// ── Test 3: Crawl stories and check for wrap regressions ─────────────────

test('text wrapping consistent across stories at breakpoint transitions', async function () {
  await page.wait(3);

  // Use the breakpoint boundary pairs — these are where layout changes happen
  var transitions: Array<{ small: ViewportCase; large: ViewportCase }> = [
    { small: { label: '639w',  width: 639,  height: 900 },
      large: { label: '640w',  width: 640,  height: 900 } },
    { small: { label: '1023w', width: 1023, height: 900 },
      large: { label: '1024w', width: 1024, height: 900 } },
    { small: { label: '1439w', width: 1439, height: 960 },
      large: { label: '1440w', width: 1440, height: 960 } },
  ];

  var allFindings: Array<{
    story: string;
    transition: string;
    nodeId: number;
    text: string;
    smallCPL: number;
    largeCPL: number;
    smallW: number;
    largeW: number;
    parentName: string;
  }> = [];

  var storiesChecked = 0;

  for (var s = 0; s < TRANSITION_STORIES.length; s++) {
    var title = TRANSITION_STORIES[s];

    // Reset to 1440 to find sidebar items
    await setViewport(1440, 960);
    var found = await navigateTo(title);
    if (!found) continue;
    storiesChecked++;

    for (var t = 0; t < transitions.length; t++) {
      var tr = transitions[t];

      // Measure at just-below-breakpoint
      await setViewport(tr.small.width, tr.small.height);
      var smallDiags = await getWrapDiagnostics();

      // Measure at just-above-breakpoint
      await setViewport(tr.large.width, tr.large.height);
      var largeDiags = await getWrapDiagnostics();

      // Build lookup
      var largeById: Record<number, WrapDiag> = {};
      for (var d = 0; d < largeDiags.length; d++) {
        largeById[largeDiags[d].id] = largeDiags[d];
      }

      // At a breakpoint transition (+1px), text should NOT suddenly wrap
      // much worse. The width increase is tiny, so CPL should be similar
      // or slightly better.
      for (var d2 = 0; d2 < smallDiags.length; d2++) {
        var sn = smallDiags[d2];
        var ln = largeById[sn.id];
        if (!ln) continue;
        if (sn.textLen < MIN_TEXT_LEN) continue;
        if (sn.noWrap || ln.noWrap) continue;
        if (sn.numLines <= 1 && ln.numLines <= 1) continue;

        // At a breakpoint boundary, the layout might switch from column to
        // row or vice versa. A moderate CPL drop is expected. But if CPL
        // drops to less than 40% of what it was, something is broken.
        if (sn.charsPerLine > 0 && ln.charsPerLine < sn.charsPerLine * 0.4) {
          allFindings.push({
            story: title,
            transition: tr.small.label + ' → ' + tr.large.label,
            nodeId: sn.id,
            text: truncate(sn.text, 30),
            smallCPL: sn.charsPerLine,
            largeCPL: ln.charsPerLine,
            smallW: Math.round(sn.w),
            largeW: Math.round(ln.w),
            parentName: ln.parentName,
          });
        }
      }
    }
  }

  if (allFindings.length > 0) {
    // Deduplicate
    var seen: Record<string, boolean> = {};
    var deduped = allFindings.filter(function (f) {
      var key = f.nodeId + ':' + f.transition;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });

    deduped.sort(function (a, b) { return a.largeCPL - b.largeCPL; });

    var details = deduped.slice(0, 15).map(function (f) {
      return '  [' + f.story + '] "' + f.text + '" at ' + f.transition
        + ' (parent=' + f.parentName + ')'
        + ' cpl: ' + f.smallCPL + ' → ' + f.largeCPL
        + ' w: ' + f.smallW + ' → ' + f.largeW;
    }).join(' || ');

    throw new Error(
      deduped.length + ' text node(s) wrap drastically worse at breakpoint transitions across '
      + storiesChecked + ' stories: ' + details
    );
  }
});

// ── Test 4: Width should grow monotonically for text in flowing containers ──

test('text container width grows monotonically with viewport (non-responsive)', async function () {
  await page.wait(3);

  // Collect diagnostics at increasing viewport widths
  var snapshots: Array<{ vp: ViewportCase; diags: WrapDiag[] }> = [];

  // Use a subset for speed
  var monotonicSweep: ViewportCase[] = [
    { label: '640w',  width: 640,  height: 900  },
    { label: '800w',  width: 800,  height: 600  },
    { label: '1024w', width: 1024, height: 768  },
    { label: '1440w', width: 1440, height: 960  },
    { label: '1920w', width: 1920, height: 1080 },
    { label: '2560w', width: 2560, height: 1440 },
  ];

  for (var v = 0; v < monotonicSweep.length; v++) {
    var vp = monotonicSweep[v];
    await setViewport(vp.width, vp.height);
    snapshots.push({ vp: vp, diags: await getWrapDiagnostics() });
  }

  // For each consecutive pair, check that text node widths don't shrink
  // (normalized for font size changes from scaling)
  var shrinks: Array<{
    text: string;
    nodeId: number;
    fromVp: string;
    toVp: string;
    fromW: number;
    toW: number;
    fromFS: number;
    toFS: number;
    parentName: string;
  }> = [];

  for (var i = 0; i < snapshots.length - 1; i++) {
    var curr = snapshots[i];
    var next = snapshots[i + 1];

    var nextById: Record<number, WrapDiag> = {};
    for (var d = 0; d < next.diags.length; d++) {
      nextById[next.diags[d].id] = next.diags[d];
    }

    for (var d2 = 0; d2 < curr.diags.length; d2++) {
      var cn = curr.diags[d2];
      var nn = nextById[cn.id];
      if (!nn) continue;
      if (cn.textLen < MIN_TEXT_LEN) continue;
      if (cn.noWrap || nn.noWrap) continue;

      // Normalize width by font size: w/fontSize gives "character slots"
      var currSlots = cn.w / Math.max(1, cn.fontSize);
      var nextSlots = nn.w / Math.max(1, nn.fontSize);

      // If character slots SHRINKS by more than 30%, the text container
      // is getting proportionally narrower at a larger viewport
      if (currSlots > 0 && nextSlots < currSlots * 0.7) {
        shrinks.push({
          text: truncate(cn.text, 40),
          nodeId: cn.id,
          fromVp: curr.vp.label,
          toVp: next.vp.label,
          fromW: Math.round(cn.w),
          toW: Math.round(nn.w),
          fromFS: cn.fontSize,
          toFS: nn.fontSize,
          parentName: nn.parentName,
        });
      }
    }
  }

  // Deduplicate by node ID
  var worstById: Record<number, typeof shrinks[0]> = {};
  for (var s = 0; s < shrinks.length; s++) {
    var item = shrinks[s];
    if (!worstById[item.nodeId] || item.toW < worstById[item.nodeId].toW) {
      worstById[item.nodeId] = item;
    }
  }

  var unique = Object.values(worstById);
  if (unique.length > 0) {
    unique.sort(function (a, b) { return a.toW - b.toW; });

    var details = unique.slice(0, 15).map(function (s) {
      return '  "' + s.text + '" (parent=' + s.parentName + ')'
        + ' ' + s.fromVp + ': w=' + s.fromW + ' fs=' + s.fromFS
        + ' → ' + s.toVp + ': w=' + s.toW + ' fs=' + s.toFS;
    }).join(' || ');

    throw new Error(
      unique.length + ' text node(s) shrink proportionally at larger viewports: ' + details
    );
  }
});

// ── Test 5: Single-line strings should never wrap ────────────────────────
// Finds strings that contain no newlines (badges, labels, short phrases)
// and checks if their height exceeds 1 line at any viewport size.
// This catches the exact bug: '@reactjit/core' wrapping at larger viewports.

test('single-line strings should stay single-line across all viewports', async function () {
  await page.wait(3);

  var allSizes: ViewportCase[] = [
    { label: '320w',  width: 320,  height: 568  },
    { label: '480w',  width: 480,  height: 800  },
    { label: '640w',  width: 640,  height: 900  },
    { label: '800w',  width: 800,  height: 600  },
    { label: '1024w', width: 1024, height: 768  },
    { label: '1280w', width: 1280, height: 900  },
    { label: '1440w', width: 1440, height: 960  },
    { label: '1920w', width: 1920, height: 1080 },
    { label: '2560w', width: 2560, height: 1440 },
    { label: '3840w', width: 3840, height: 2160 },
  ];

  type WrappedSingle = {
    story: string;
    viewport: string;
    text: string;
    nodeId: number;
    h: number;
    w: number;
    lineHeight: number;
    numLines: number;
    fontSize: number;
    naturalW: number;
    parentW: number;
    parentName: string;
  };

  var violations: WrappedSingle[] = [];
  var storiesChecked = 0;
  var reportLines: string[] = [];
  reportLines.push('=== SINGLE-LINE WRAP REPORT ===');
  reportLines.push('');

  for (var s = 0; s < ALL_STORIES.length; s++) {
    var title = ALL_STORIES[s];

    await setViewport(1440, 960);
    var found = await navigateTo(title);
    if (!found) continue;
    storiesChecked++;

    var storyViolations: WrappedSingle[] = [];

    for (var v = 0; v < allSizes.length; v++) {
      var vp = allSizes[v];
      await setViewport(vp.width, vp.height);
      var diags = await getWrapDiagnostics();

      for (var d = 0; d < diags.length; d++) {
        var node = diags[d];

        // Skip empty or very short text
        if (node.textLen < 3) continue;
        // Skip text with actual newlines (those are supposed to wrap)
        if (node.text.indexOf('\n') !== -1) continue;
        // Skip noWrap text (already handled)
        if (node.noWrap) continue;

        // A single-line string should have numLines == 1.
        // If numLines > 1, the string is wrapping when it shouldn't.
        if (node.numLines > 1) {
          var entry: WrappedSingle = {
            story: title,
            viewport: vp.label,
            text: truncate(node.text, 50),
            nodeId: node.id,
            h: Math.round(node.h),
            w: Math.round(node.w),
            lineHeight: Math.round(node.lineHeight),
            numLines: node.numLines,
            fontSize: node.fontSize,
            naturalW: Math.round(node.naturalW),
            parentW: Math.round(node.parentW),
            parentName: node.parentName,
          };
          violations.push(entry);
          storyViolations.push(entry);
        }
      }
    }

    if (storyViolations.length > 0) {
      reportLines.push('--- ' + title + ' (' + storyViolations.length + ' violations) ---');
      for (var sv = 0; sv < storyViolations.length; sv++) {
        var e = storyViolations[sv];
        reportLines.push(
          '  [' + e.viewport + '] "' + e.text + '"'
          + ' | lines=' + e.numLines + ' h=' + e.h + ' lh=' + e.lineHeight
          + ' | w=' + e.w + ' naturalW=' + e.naturalW
          + ' | fs=' + e.fontSize + ' parentW=' + e.parentW
          + ' parent=' + e.parentName
        );
      }
      reportLines.push('');
    }
  }

  // Deduplicate: group by nodeId, show which viewports trigger wrapping
  var byNode: Record<number, WrappedSingle[]> = {};
  for (var i = 0; i < violations.length; i++) {
    var v2 = violations[i];
    if (!byNode[v2.nodeId]) byNode[v2.nodeId] = [];
    byNode[v2.nodeId].push(v2);
  }

  var uniqueNodes = Object.keys(byNode).length;

  reportLines.push('=== SUMMARY ===');
  reportLines.push('Stories checked: ' + storiesChecked + '/' + ALL_STORIES.length);
  reportLines.push('Total single-line wrap violations: ' + violations.length);
  reportLines.push('Unique nodes affected: ' + uniqueNodes);
  reportLines.push('');

  // Per-node summary
  reportLines.push('=== PER-NODE BREAKDOWN ===');
  var nodeIds = Object.keys(byNode);
  for (var n = 0; n < Math.min(nodeIds.length, 30); n++) {
    var nid = nodeIds[n];
    var entries = byNode[Number(nid)];
    var first = entries[0];
    var vpList = entries.map(function (e) {
      return e.viewport + '(' + e.numLines + 'L,w=' + e.w + ')';
    }).join(', ');
    reportLines.push(
      '  #' + nid + ' "' + first.text + '" [' + first.story + ']'
      + ' wraps at: ' + vpList
    );
  }

  // Write report
  await bridge.rpc('test:writeFile', {
    path: '/tmp/text-wrap-singleline-report.txt',
    content: reportLines.join('\n'),
  });

  if (uniqueNodes > 0) {
    // Build concise error with worst offenders
    var worst = nodeIds.slice(0, 10).map(function (nid) {
      var entries = byNode[Number(nid)];
      var first = entries[0];
      var vpList = entries.map(function (e) { return e.viewport; }).join(',');
      return '"' + first.text + '" (' + first.story + ') wraps at [' + vpList + ']'
        + ' naturalW=' + first.naturalW + ' allocW=' + first.w;
    }).join(' || ');

    throw new Error(
      uniqueNodes + ' single-line string(s) wrap across viewports.'
      + ' Full report: /tmp/text-wrap-singleline-report.txt'
      + ' || Worst: ' + worst
    );
  }
});

// ── Test 6: Full diagnostic crawl — writes report to /tmp ────────────────

test('diagnostic dump: crawl all stories and report wrap metrics', async function () {
  await page.wait(3);

  var diagSizes: ViewportCase[] = [
    { label: '800w',  width: 800,  height: 600  },
    { label: '1920w', width: 1920, height: 1080 },
  ];

  var lines: string[] = [];
  lines.push('=== TEXT WRAP DIAGNOSTIC REPORT ===');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('');

  var totalNodes = 0;
  var worstNodes: Array<{
    story: string;
    vp: string;
    text: string;
    cpl: number;
    w: number;
    fs: number;
    lines: number;
    parent: string;
    naturalW: number;
    wrapRatio: number;
  }> = [];

  var storiesChecked = 0;

  for (var s = 0; s < ALL_STORIES.length; s++) {
    var title = ALL_STORIES[s];

    await setViewport(1440, 960);
    var found = await navigateTo(title);
    if (!found) {
      lines.push('[SKIP] ' + title + ' — not found in sidebar');
      continue;
    }
    storiesChecked++;
    lines.push('--- ' + title + ' ---');

    for (var v = 0; v < diagSizes.length; v++) {
      var vp = diagSizes[v];
      await setViewport(vp.width, vp.height);
      var diags = await getWrapDiagnostics();

      var storyNodeCount = 0;
      var storyWorstCPL = 999;

      for (var d = 0; d < diags.length; d++) {
        var node = diags[d];
        if (node.textLen < MIN_TEXT_LEN) continue;
        if (node.noWrap) continue;
        totalNodes++;
        storyNodeCount++;

        if (node.charsPerLine < storyWorstCPL) {
          storyWorstCPL = node.charsPerLine;
        }

        // Collect nodes with CPL < 8 for the "worst" report
        if (node.charsPerLine < 8 && node.numLines > 1) {
          worstNodes.push({
            story: title,
            vp: vp.label,
            text: truncate(node.text, 50),
            cpl: node.charsPerLine,
            w: Math.round(node.w),
            fs: node.fontSize,
            lines: node.numLines,
            parent: node.parentName,
            naturalW: Math.round(node.naturalW),
            wrapRatio: node.wrapRatio,
          });
        }
      }

      lines.push('  ' + vp.label + ': ' + storyNodeCount + ' text nodes, worst CPL=' + storyWorstCPL);
    }

    lines.push('');
  }

  // Sort worst nodes by CPL ascending (worst first)
  worstNodes.sort(function (a, b) { return a.cpl - b.cpl; });

  lines.push('');
  lines.push('=== WORST WRAPPED TEXT NODES (CPL < 8) ===');
  lines.push('Total found: ' + worstNodes.length);
  lines.push('');

  for (var w = 0; w < Math.min(worstNodes.length, 50); w++) {
    var wn = worstNodes[w];
    lines.push(
      '  [' + wn.story + ' @ ' + wn.vp + '] "' + wn.text + '"'
      + ' | cpl=' + wn.cpl + ' lines=' + wn.lines
      + ' | w=' + wn.w + 'px fs=' + wn.fs + 'px'
      + ' | naturalW=' + wn.naturalW + 'px wrapRatio=' + wn.wrapRatio
      + ' | parent=' + wn.parent
    );
  }

  lines.push('');
  lines.push('=== SUMMARY ===');
  lines.push('Stories checked: ' + storiesChecked + '/' + ALL_STORIES.length);
  lines.push('Total text nodes analyzed: ' + totalNodes);
  lines.push('Nodes with CPL < 8: ' + worstNodes.length);

  // Write report to /tmp
  var report = lines.join('\n');
  await bridge.rpc('test:writeFile', {
    path: '/tmp/text-wrap-report.txt',
    content: report,
  });

  // Take a screenshot at the end for reference
  await page.screenshot('/tmp/text-wrap-final.png');

  // This test always passes — it's diagnostic only.
  // Check /tmp/text-wrap-report.txt for details.
});
