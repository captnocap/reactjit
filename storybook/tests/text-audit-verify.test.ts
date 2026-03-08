// Verify text audit violations are real by snapping screenshots of reported areas.
// Run: cd storybook && rjit test tests/text-audit-verify.test.ts

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

// Verify a few specific violations from the crawl results

test('verify: Files story - Half text overflow', async function () {
  await page.wait(3);
  await navigateTo('Files');
  await page.screenshot('/tmp/verify-files-full.png');

  var result = await page.textAudit();
  var overlaps = result.violations.filter(function(v: any) {
    return v.rule === 'text-overlap';
  });
  var escapes = result.violations.filter(function(v: any) {
    return v.rule === 'text-escape';
  });
  var cbOverlaps = result.violations.filter(function(v: any) {
    return v.rule === 'text-codeblock-overlap';
  });

  // Snap the first overlap if any
  if (overlaps.length > 0) {
    var v = overlaps[0];
    await _bridge.rpc('test:snap', {
      x: v.nodeRect.x, y: v.nodeRect.y,
      w: v.nodeRect.w, h: v.nodeRect.h,
      path: '/tmp/verify-files-overlap.png', padding: 20,
    });
  }
  if (cbOverlaps.length > 0) {
    var v2 = cbOverlaps[0];
    await _bridge.rpc('test:snap', {
      x: v2.nodeRect.x, y: v2.nodeRect.y,
      w: v2.nodeRect.w, h: v2.nodeRect.h,
      path: '/tmp/verify-files-cb-overlap.png', padding: 20,
    });
  }

  // Report findings as the error message (single line)
  var msg = 'Files: ' + overlaps.length + ' text-overlap, '
    + cbOverlaps.length + ' text-codeblock-overlap, '
    + escapes.length + ' text-escape';
  if (overlaps.length > 0) msg += ' | first overlap: ' + overlaps[0].message;
  throw new Error(msg);
});

test('verify: Effects story - text escape', async function () {
  await navigateTo('Effects');
  await page.screenshot('/tmp/verify-effects-full.png');

  var result = await page.textAudit();
  var escapes = result.violations.filter(function(v: any) {
    return v.rule === 'text-escape';
  });
  var overlaps = result.violations.filter(function(v: any) {
    return v.rule === 'text-overlap';
  });

  // Snap first escape
  if (escapes.length > 0) {
    var v = escapes[0];
    await _bridge.rpc('test:snap', {
      x: v.nodeRect.x, y: v.nodeRect.y,
      w: Math.max(v.nodeRect.w, v.parentRect ? v.parentRect.w : v.nodeRect.w),
      h: v.nodeRect.h,
      path: '/tmp/verify-effects-escape.png', padding: 20,
    });
  }

  var msg = 'Effects: ' + escapes.length + ' text-escape, '
    + overlaps.length + ' text-overlap';
  if (escapes.length > 0) msg += ' | first escape: ' + escapes[0].message;
  throw new Error(msg);
});

test('verify: Networking story - breadcrumb/codeblock overlap', async function () {
  await navigateTo('Networking');
  await page.screenshot('/tmp/verify-networking-full.png');

  var result = await page.textAudit();
  var cbOverlaps = result.violations.filter(function(v: any) {
    return v.rule === 'text-codeblock-overlap';
  });

  if (cbOverlaps.length > 0) {
    var v = cbOverlaps[0];
    // Snap a region that shows both the text and the codeblock
    var minX = Math.min(v.nodeRect.x, v.siblingRect.x);
    var minY = Math.min(v.nodeRect.y, v.siblingRect.y);
    var maxX = Math.max(v.nodeRect.x + v.nodeRect.w, v.siblingRect.x + v.siblingRect.w);
    var maxY = Math.max(v.nodeRect.y + v.nodeRect.h, v.siblingRect.y + v.siblingRect.h);
    await _bridge.rpc('test:snap', {
      x: minX, y: minY, w: maxX - minX, h: maxY - minY,
      path: '/tmp/verify-networking-cb-overlap.png', padding: 20,
    });
  }

  var msg = 'Networking: ' + cbOverlaps.length + ' text-codeblock-overlap';
  if (cbOverlaps.length > 0) msg += ' | first: ' + cbOverlaps[0].message;
  throw new Error(msg);
});
