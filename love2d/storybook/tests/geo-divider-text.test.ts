// Divider-text overlap test for the Geo story across breakpoints.
// Run: cd storybook && rjit test tests/geo-divider-text.test.ts

var _bridge = (globalThis as any).__rjitBridge;

var BREAKPOINTS = [
  { name: 'sm',     w: 480,  h: 600 },
  { name: 'md',     w: 640,  h: 600 },
  { name: 'repro',  w: 769,  h: 1143 },
  { name: 'mid',    w: 800,  h: 600 },
  { name: 'lg',     w: 1024, h: 700 },
  { name: 'xl',     w: 1440, h: 800 },
];

async function navigateByIndex(idx: number) {
  for (var i = 0; i < idx; i++) {
    await _bridge.rpc('test:key', { key: 'down' });
    await page.wait(1);
  }
  await page.wait(5);
}

test('Geo story: no text-divider overlap at any breakpoint', async function () {
  await page.wait(3);
  await navigateByIndex(30);

  var allViolations: any[] = [];

  for (var bi = 0; bi < BREAKPOINTS.length; bi++) {
    var bp = BREAKPOINTS[bi];
    await page.resize(bp.w, bp.h);
    await page.wait(15);

    // Divider audit
    var divResult = await page.dividerAudit();
    for (var di = 0; di < divResult.violations.length; di++) {
      var v = divResult.violations[di];
      allViolations.push({
        breakpoint: bp.name, viewport: bp.w + 'x' + bp.h,
        rule: v.rule, message: v.message,
      });
    }

    // Text escape + overlap
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

    await page.screenshot('/tmp/geo-divider-' + bp.name + '.png');
  }

  await _bridge.rpc('test:writeFile', {
    path: '/tmp/geo-divider-violations.txt',
    content: allViolations.length + ' violations:\n' + allViolations.map(function(v: any) {
      return '[' + v.breakpoint + ' (' + v.viewport + ')] ' + v.rule + ': ' + v.message;
    }).join('\n'),
  });

  if (allViolations.length > 0) {
    throw new Error(allViolations.length + ' violations found. See /tmp/geo-divider-violations.txt');
  }
});
