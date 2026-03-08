// Divider-text overlap test for the Data story across breakpoints.
// Detects text nodes clipping into thin separator elements at various viewport sizes.
// Run: cd storybook && rjit test tests/divider-text-data.test.ts

var _bridge = (globalThis as any).__rjitBridge;

var BREAKPOINTS = [
  { name: 'repro',  w: 769,  h: 1143 },
];

async function navigateByIndex(idx: number) {
  for (var i = 0; i < idx; i++) {
    await _bridge.rpc('test:key', { key: 'down' });
    await page.wait(1);
  }
  await page.wait(5);
}

test('Data story: no text-divider overlap at any breakpoint', async function () {
  await page.wait(3);
  await navigateByIndex(12);

  var allViolations: any[] = [];

  for (var bi = 0; bi < BREAKPOINTS.length; bi++) {
    var bp = BREAKPOINTS[bi];
    await page.resize(bp.w, bp.h);
    await page.wait(15);

    // Divider audit — the primary check
    var divResult: any = await page.dividerAudit();
    for (var di = 0; di < divResult.violations.length; di++) {
      var v = divResult.violations[di];
      allViolations.push({
        breakpoint: bp.name, viewport: bp.w + 'x' + bp.h,
        rule: v.rule, message: v.message,
      });
    }

    // Dump divider debug info
    var debugLines: string[] = [];
    debugLines.push('=== DIVIDER DEBUG @ ' + bp.name + ' (' + bp.w + 'x' + bp.h + ') ===');
    debugLines.push('Stats: ' + JSON.stringify(divResult.stats || {}));
    debugLines.push('Dividers found: ' + (divResult.dividerDump || []).length);
    var dd = divResult.dividerDump || [];
    for (var ddi = 0; ddi < dd.length; ddi++) {
      debugLines.push('  [' + ddi + '] ' + dd[ddi].name + ' ' + (dd[ddi].horizontal ? 'H' : 'V')
        + ' @ (' + Math.round(dd[ddi].x) + ',' + Math.round(dd[ddi].y) + ' ' + Math.round(dd[ddi].w) + 'x' + Math.round(dd[ddi].h) + ')');
    }
    debugLines.push('Divider violations: ' + divResult.violations.length);
    await _bridge.rpc('test:writeFile', {
      path: '/tmp/data-story-divider-debug.txt',
      content: debugLines.join('\n'),
    });

    // Text audit — ALL rules (escape, overlap, truncation, etc.)
    var textResult = await page.textAudit();
    for (var ti = 0; ti < textResult.violations.length; ti++) {
      var tv = textResult.violations[ti];
      allViolations.push({
        breakpoint: bp.name, viewport: bp.w + 'x' + bp.h,
        rule: tv.rule, message: tv.message,
      });
    }

    // Layout audit — child overflow and sibling overlap (errors only)
    var layoutResult = await page.audit();
    for (var li = 0; li < layoutResult.errors.length; li++) {
      var lv = layoutResult.errors[li];
      allViolations.push({
        breakpoint: bp.name, viewport: bp.w + 'x' + bp.h,
        rule: lv.rule, message: lv.message,
      });
    }

    await page.screenshot('/tmp/data-story-' + bp.name + '.png');
  }

  await _bridge.rpc('test:writeFile', {
    path: '/tmp/data-story-violations.txt',
    content: allViolations.length + ' violations:\n' + allViolations.map(function(v: any) {
      return '[' + v.breakpoint + ' (' + v.viewport + ')] ' + v.rule + ': ' + v.message;
    }).join('\n'),
  });

  if (allViolations.length > 0) {
    throw new Error(allViolations.length + ' violations found. See /tmp/data-story-violations.txt');
  }
});
