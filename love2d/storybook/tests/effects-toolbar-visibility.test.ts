// Effects toolbar visibility — test that the tab bar and footer remain
// visible at various window widths (300-800 in 50px increments).
//
// The Effects story uses Layout3 (full viewport, no scroll). At narrow
// widths, the command center wraps and grows taller, pushing the tab bar
// and footer off the bottom of the viewport.
//
// Run: cd storybook && rjit test tests/effects-toolbar-visibility.test.ts

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

test('Effects tab bar and footer visible at all widths', async function () {
  await page.wait(3);

  // Wait for sidebar to render fully
  await page.wait(5);

  // Navigate at default 800x600 (sidebar visible)
  var found = await navigateTo('Effects');
  if (!found) {
    var allT = await page.find('Text').all();
    var names = allT.slice(0, 30).map(function(t: any) { return '"' + t.text + '"'; });
    throw new Error('Could not navigate to Effects. Found: ' + names.join(', '));
  }
  await page.wait(5);

  // Verify we landed on Effects
  await page.screenshot('/tmp/effects-before-resize.png');

  var widths = [300, 350, 400, 450, 500, 550, 600, 700, 800];
  var vpH = 600;
  var failures = [];

  for (var w = 0; w < widths.length; w++) {
    var width = widths[w];

    // Resize (navigation already done)
    await _bridge.rpc('test:resize', { width: width, height: vpH });
    await page.wait(5);

    await page.screenshot('/tmp/effects-w' + width + '.png');

    var allTexts = await page.find('Text').all();
    var spirographTab = null;
    var footerText = null;
    var effectsHeader = null;

    for (var i = 0; i < allTexts.length; i++) {
      var t = allTexts[i];
      if (t.text === 'Spirograph' && !spirographTab) spirographTab = t;
      if (t.text === 'Packages' && !footerText) footerText = t;
      if (t.text === 'Effects' && !effectsHeader) effectsHeader = t;
    }

    if (!effectsHeader) {
      failures.push('w=' + width + ': NOT ON EFFECTS PAGE');
      continue;
    }

    // Check tab bar
    if (spirographTab) {
      if (spirographTab.y + spirographTab.h > vpH) {
        failures.push('w=' + width + ': TAB BAR OFF SCREEN (y=' + Math.round(spirographTab.y) + ' bottom=' + Math.round(spirographTab.y + spirographTab.h) + ')');
      }
    } else {
      failures.push('w=' + width + ': TAB BAR MISSING');
    }

    // Check footer
    if (footerText) {
      if (footerText.y + footerText.h > vpH) {
        failures.push('w=' + width + ': FOOTER OFF SCREEN (y=' + Math.round(footerText.y) + ' bottom=' + Math.round(footerText.y + footerText.h) + ')');
      }
    } else {
      failures.push('w=' + width + ': FOOTER MISSING');
    }
  }

  // Restore
  await _bridge.rpc('test:resize', { width: 800, height: 600 });

  if (failures.length > 0) {
    throw new Error(failures.join(' | '));
  }
});
