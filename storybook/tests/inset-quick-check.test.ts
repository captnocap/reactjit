// Quick check: does the insetWidth fix reduce single-line wrapping?
// Just tests the currently-visible story at a few key sizes.

var bridge = (globalThis as any).__rjitBridge as {
  rpc<T = any>(method: string, args?: any, timeoutMs?: number): Promise<T>;
};

async function setVp(w: number, h: number) {
  await bridge.rpc('window:setSize', { width: w, height: h });
  await page.wait(3);
}

async function getDiags(): Promise<any[]> {
  var result = await bridge.rpc('test:text-wrap-diag', {});
  return Array.isArray(result) ? result : [];
}

test('insetWidth quick check — single-line wrapping at key sizes', async function () {
  await page.wait(3);

  var sizes = [
    { label: '800w', w: 800, h: 600 },
    { label: '1024w', w: 1024, h: 768 },
    { label: '1920w', w: 1920, h: 1080 },
  ];

  var totalViolations = 0;
  var lines: string[] = [];

  for (var i = 0; i < sizes.length; i++) {
    var s = sizes[i];
    await setVp(s.w, s.h);
    var diags = await getDiags();
    var wrapping = 0;

    for (var d = 0; d < diags.length; d++) {
      var n = diags[d];
      if (n.textLen < 3) continue;
      if (n.text.indexOf('\n') !== -1) continue;
      if (n.noWrap) continue;
      if (n.numLines > 1) {
        wrapping++;
        if (wrapping <= 5) {
          lines.push('  [' + s.label + '] "' + n.text.slice(0, 40) + '" lines=' + n.numLines + ' w=' + Math.round(n.w) + ' naturalW=' + Math.round(n.naturalW) + ' parentW=' + Math.round(n.parentW));
        }
      }
    }

    lines.push(s.label + ': ' + diags.length + ' text nodes, ' + wrapping + ' single-line violations');
    totalViolations += wrapping;
  }

  // Write quick report
  await bridge.rpc('test:writeFile', {
    path: '/tmp/inset-quick-check.txt',
    content: lines.join('\n'),
  });

  // Log summary — don't fail, just report
  if (totalViolations > 0) {
    throw new Error(totalViolations + ' single-line strings wrapping. Report: /tmp/inset-quick-check.txt');
  }
});
