// Sweep all stories at multiple breakpoints for text-divider overlap.
// Detects text nodes clipping/overlapping thin separator elements (dividers)
// at different viewport widths.
//
// Run: cd storybook && rjit test tests/divider-text-sweep.test.ts

var _bridge = (globalThis as any).__rjitBridge;

// Breakpoints: sm boundary, md, between md/lg, lg, xl
var BREAKPOINTS = [
  { name: 'sm',    w: 480,  h: 600 },
  { name: 'md',    w: 640,  h: 600 },
  { name: 'mid',   w: 800,  h: 600 },
  { name: 'lg',    w: 1024, h: 600 },
  { name: 'xl',    w: 1440, h: 800 },
];

// Stories to sweep — all content stories from index.ts
// Excluding stress tests, dev tools, error tests, layout templates
var STORIES = [
  'Gallery', 'Hook Gallery', 'Box', 'Text', 'Layout', 'Style',
  'Image & Video', 'Image Gallery', 'Input', 'Monaco Mirror', 'Icons',
  'Navigation', 'Data', 'Windows', 'Animation', 'Classifier',
  'Networking', 'Crypto', 'Files', 'Effects', 'Masks', 'Time',
  'Math', 'Conversions', 'Spreadsheet', 'Privacy', 'Capabilities',
  'Storage', 'Audio', '3D', 'Geo', 'Presentation', 'Render',
  'Demos', 'Physics', 'Imaging', 'Capture',
  'Compatibility', 'Overlay',
  'CreativeConcepts', 'AI', 'Finance', 'Chemistry',
];

async function navigateTo(storyTitle: string): Promise<boolean> {
  // First go back to home/sidebar — click the sidebar title area
  // The storybook sidebar shows story titles as Text nodes
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

test('sweep all stories for text-divider overlap at all breakpoints', async function () {
  await page.wait(3);

  var allViolations: any[] = [];

  for (var si = 0; si < STORIES.length; si++) {
    var story = STORIES[si];

    // Navigate to story
    var found = await navigateTo(story);
    if (!found) {
      // Story might not be visible in sidebar — skip silently
      continue;
    }

    for (var bi = 0; bi < BREAKPOINTS.length; bi++) {
      var bp = BREAKPOINTS[bi];

      // Resize viewport
      await page.resize(bp.w, bp.h);
      // Extra settle time for layout reflow
      await page.wait(3);

      // Run divider audit
      var divResult = await page.dividerAudit();

      // Also run text audit for text-escape violations (text escaping containers
      // that then visually clip with dividers)
      var textResult = await page.textAudit();
      var escapes = textResult.violations.filter(function(v: any) {
        return v.rule === 'text-escape';
      });

      // Collect violations tagged with story + breakpoint context
      for (var di = 0; di < divResult.violations.length; di++) {
        var v = divResult.violations[di];
        allViolations.push({
          story: story,
          breakpoint: bp.name,
          viewport: bp.w + 'x' + bp.h,
          rule: v.rule,
          message: v.message,
          nodeRect: v.nodeRect,
          dividerRect: v.dividerRect,
        });
      }
      for (var ei = 0; ei < escapes.length; ei++) {
        var ev = escapes[ei];
        allViolations.push({
          story: story,
          breakpoint: bp.name,
          viewport: bp.w + 'x' + bp.h,
          rule: ev.rule,
          message: ev.message,
          nodeRect: ev.nodeRect,
          parentRect: ev.parentRect,
        });
      }
    }
  }

  // Report all violations
  if (allViolations.length > 0) {
    var summary = allViolations.map(function(v: any) {
      return '[' + v.story + ' @ ' + v.breakpoint + ' (' + v.viewport + ')] '
        + v.rule + ': ' + v.message;
    }).join('\n');
    throw new Error(allViolations.length + ' text-divider violations found:\n' + summary);
  }
});
