// Focused divider-text overlap test for the Data story at all breakpoints.
// Run: cd storybook && rjit test tests/divider-text-data.test.ts

var _bridge = (globalThis as any).__rjitBridge;

var BREAKPOINTS = [
  { name: 'sm',     w: 480,  h: 600 },
  { name: 'md',     w: 640,  h: 600 },
  { name: 'repro',  w: 769,  h: 1143 },
  { name: 'mid',    w: 800,  h: 600 },
  { name: 'lg',     w: 1024, h: 600 },
  { name: 'xl',     w: 1440, h: 800 },
];

// Navigate to a story by pressing down arrow N times from the start (index 0).
async function navigateByIndex(idx: number) {
  for (var i = 0; i < idx; i++) {
    await _bridge.rpc('test:key', { key: 'down' });
    await page.wait(1);
  }
  // Let layout settle
  await page.wait(5);
}

test('Data story: full audit at all breakpoints', async function () {
  await page.wait(3);

  // Data is at index 12 in the stories array
  await navigateByIndex(12);

  var allViolations: any[] = [];

  for (var bi = 0; bi < BREAKPOINTS.length; bi++) {
    var bp = BREAKPOINTS[bi];
    await page.resize(bp.w, bp.h);
    await page.wait(5);

    // 1. Divider audit — text overlapping thin separators
    var divResult = await page.dividerAudit();
    for (var di = 0; di < divResult.violations.length; di++) {
      var v = divResult.violations[di];
      allViolations.push({
        breakpoint: bp.name, viewport: bp.w + 'x' + bp.h,
        rule: v.rule, message: v.message,
      });
    }

    // 2. Text audit — text-escape + text-overlap
    var textResult = await page.textAudit();
    for (var ti = 0; ti < textResult.violations.length; ti++) {
      var tv = textResult.violations[ti];
      if (tv.rule === 'text-escape' || tv.rule === 'text-overlap') {
        allViolations.push({
          breakpoint: bp.name, viewport: bp.w + 'x' + bp.h,
          rule: tv.rule, message: tv.message,
        });
      }
    }

    // 3. Layout audit — child overflow and sibling overlap (errors only)
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

  // Write violations to file (test output truncates long errors)
  var summary = allViolations.map(function(v: any) {
    return '[' + v.breakpoint + ' (' + v.viewport + ')] ' + v.rule + ': ' + v.message;
  }).join('\n');
  await _bridge.rpc('test:writeFile', {
    path: '/tmp/data-story-violations.txt',
    content: allViolations.length + ' violations:\n' + summary,
  });

  if (allViolations.length > 0) {
    throw new Error(allViolations.length + ' violations found. See /tmp/data-story-violations.txt');
  }
});
