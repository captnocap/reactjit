// Verify remaining Effects/Masks slider violations
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

test('verify Effects slider violations', async function () {
  await page.wait(3);
  await navigateTo('Effects');
  await page.wait(3);

  var result = await page.textAudit();

  // Snap the slider control bar area (bottom of Effects page)
  // Get a violation rect and snap a wider area around it
  if (result.violations.length > 0) {
    var v = result.violations[0];
    // Snap the full slider row — use a wide horizontal strip
    await _bridge.rpc('test:snap', {
      x: 100, y: v.nodeRect.y - 10,
      w: 700, h: 50,
      path: '/tmp/verify-effects-slider-row.png', padding: 4,
    });

    // Also snap the specific violating element with its parent
    if (v.parentRect) {
      await _bridge.rpc('test:snap', {
        x: Math.min(v.nodeRect.x, v.parentRect.x) - 30,
        y: Math.min(v.nodeRect.y, v.parentRect.y),
        w: Math.max(v.nodeRect.w, v.parentRect.w) + 60,
        h: Math.max(v.nodeRect.h, v.parentRect.h),
        path: '/tmp/verify-effects-slider-detail.png', padding: 10,
      });
    }
  }

  // Full page for context
  await page.screenshot('/tmp/verify-effects-full2.png');

  // Report with rect details for debugging
  var msgs = result.violations.map(function(v: any) {
    var r = v.nodeRect;
    var p = v.parentRect || {};
    return v.rule + ': "' + v.message.split('(text:')[1]
      + ' node@(' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.w) + 'x' + Math.round(r.h) + ')'
      + (v.parentRect ? ' parent@(' + Math.round(p.x) + ',' + Math.round(p.y) + ' ' + Math.round(p.w) + 'x' + Math.round(p.h) + ')' : '');
  });

  throw new Error('Effects: ' + result.violations.length + ' violations\n' + msgs.join(' | '));
});
