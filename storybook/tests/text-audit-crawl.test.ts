// Text Audit Crawl — navigates every storybook story and checks for:
//   1. Text nodes overlapping other text nodes
//   2. Text nodes overlapping CodeBlock nodes
//   3. Text escaping its container bounds
//   4. Text truncation (measured width > allocated width)
//
// Run: cd storybook && rjit test tests/text-audit-crawl.test.ts

// Story titles in sidebar order (from index.ts)
// Split into batches to avoid segfaults from long-running processes
var ALL_STORIES = [
  // Core
  'Gallery', 'Hook Gallery', 'Box', 'Text', 'Layout', 'Style',
  'Image & Video', 'Input', 'Icons',
  'Navigation', 'Data', 'Windows', 'Animation', 'Classifier',
  // Packages
  'Networking', 'Crypto', 'Files', 'Effects', 'Masks', 'Time', 'Math',
  'Conversions', 'Privacy', 'Capabilities', 'Storage',
  'Audio', 'Render', 'Physics', 'Imaging', 'Capture',
  // Packages (cont.)
  'AI', 'Finance', 'Chemistry',
];

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

test('text audit crawl — all stories', async function () {
  // Wait for initial render
  await page.wait(3);

  var allFindings = [];
  var storiesChecked = 0;
  var storiesSkipped = [];

  for (var s = 0; s < ALL_STORIES.length; s++) {
    var title = ALL_STORIES[s];

    var found = await navigateTo(title);
    if (!found) {
      storiesSkipped.push(title);
      continue;
    }
    storiesChecked++;

    // Run text audit
    var result = await page.textAudit();

    if (result.violations.length > 0) {
      for (var v = 0; v < result.violations.length; v++) {
        var viol = result.violations[v];
        allFindings.push({
          story: title,
          rule: viol.rule,
          severity: viol.severity,
          message: viol.message,
        });
      }
    }
  }

  // Print summary
  var summary = '\n=== TEXT AUDIT CRAWL RESULTS ===\n';
  summary += 'Stories checked: ' + storiesChecked + '/' + ALL_STORIES.length + '\n';
  if (storiesSkipped.length > 0) {
    summary += 'Skipped (not found in sidebar): ' + storiesSkipped.join(', ') + '\n';
  }
  summary += 'Total violations: ' + allFindings.length + '\n\n';

  // Group by rule
  var byRule = {};
  for (var f = 0; f < allFindings.length; f++) {
    var finding = allFindings[f];
    if (!byRule[finding.rule]) byRule[finding.rule] = [];
    byRule[finding.rule].push(finding);
  }

  var rules = Object.keys(byRule);
  for (var r = 0; r < rules.length; r++) {
    var rule = rules[r];
    var items = byRule[rule];
    summary += '--- ' + rule + ' (' + items.length + ') ---\n';
    for (var k = 0; k < items.length; k++) {
      summary += '  [' + items[k].story + '] ' + items[k].message + '\n';
    }
    summary += '\n';
  }

  // Also group by story for overview
  var byStory = {};
  for (var f2 = 0; f2 < allFindings.length; f2++) {
    var item = allFindings[f2];
    if (!byStory[item.story]) byStory[item.story] = { errors: 0, warnings: 0 };
    if (item.severity === 'error') byStory[item.story].errors++;
    else byStory[item.story].warnings++;
  }

  summary += '--- PER-STORY SUMMARY ---\n';
  var storyNames = Object.keys(byStory);
  for (var sn = 0; sn < storyNames.length; sn++) {
    var name = storyNames[sn];
    var counts = byStory[name];
    summary += '  ' + name + ': ' + counts.errors + ' errors, ' + counts.warnings + ' warnings\n';
  }

  if (allFindings.length === 0) {
    summary += '\nAll clear — no text violations found.\n';
  }

  // Count by type
  var errorCount = allFindings.filter(function(f) { return f.severity === 'error'; }).length;
  var warnCount = allFindings.filter(function(f) { return f.severity === 'warning'; }).length;

  // Use screenshot RPC to write summary to /tmp (hacky but works)
  await page.screenshot('/tmp/text-audit-final-frame.png');

  // Throw a single-line summary (newlines break the test protocol)
  if (allFindings.length > 0) {
    // Flatten the summary: replace newlines with " | "
    var flat = summary.replace(/\n+/g, ' | ').replace(/\s*\|\s*\|\s*/g, ' | ');
    throw new Error('TEXT AUDIT: ' + errorCount + ' errors, ' + warnCount + ' warnings across ' + storiesChecked + ' stories. Details: ' + flat);
  }
});
