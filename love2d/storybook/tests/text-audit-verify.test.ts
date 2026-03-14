// Verify text audit violations are fixed in specific stories.
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

test('Files story has no text violations', async function () {
  await page.wait(3);
  await navigateTo('Files');

  var result = await page.textAudit();
  if (result.violations.length > 0) {
    var msg = 'Files: ' + result.violations.length + ' violations';
    var first = result.violations[0];
    msg += ' | first: ' + first.rule + ' ' + first.message;
    throw new Error(msg);
  }
});

test('Effects story has no text violations', async function () {
  await navigateTo('Effects');

  var result = await page.textAudit();
  if (result.violations.length > 0) {
    var msg = 'Effects: ' + result.violations.length + ' violations';
    var first = result.violations[0];
    msg += ' | first: ' + first.rule + ' ' + first.message;
    throw new Error(msg);
  }
});

test('Networking story has no text violations', async function () {
  await navigateTo('Networking');

  var result = await page.textAudit();
  if (result.violations.length > 0) {
    var msg = 'Networking: ' + result.violations.length + ' violations';
    var first = result.violations[0];
    msg += ' | first: ' + first.rule + ' ' + first.message;
    throw new Error(msg);
  }
});
