// Verify Effects slider text violations are fixed.
// Run: cd storybook && rjit test tests/text-audit-verify2.test.ts

var _bridge = (globalThis as any).__rjitBridge;

async function navigateTo(storyTitle: string) {
  var allText = await page.find('Text').all();
  for (var i = 0; i < allText.length; i++) {
    if (allText[i].text === storyTitle) {
      await _bridge.rpc('test:click', { x: allText[i].cx, y: allText[i].cy });
      await page.wait(5);
      return true;
    }
  }
  return false;
}

test('Effects story has no slider text violations', async function () {
  await page.wait(3);
  await navigateTo('Effects');
  await page.wait(3);

  var result = await page.textAudit();

  if (result.violations.length > 0) {
    var msgs = result.violations.map(function(v: any) {
      var r = v.nodeRect;
      return v.rule + ': ' + v.message
        + ' node@(' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.w) + 'x' + Math.round(r.h) + ')';
    });
    throw new Error('Effects: ' + result.violations.length + ' violations\n' + msgs.join(' | '));
  }
});
