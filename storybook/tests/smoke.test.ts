// Minimal smoke test — verify the rjit test pipeline works at all.

test('page.find returns a locator', async () => {
  const box = page.find('Box');
  const results = await box.all();
  if (results.length === 0) {
    throw new Error('No Box elements found in tree');
  }
});

test('expect toBeFound works', async () => {
  await expect(page.find('Box')).toBeFound();
});

test('page.audit returns violations array', async () => {
  const result = await page.audit();
  if (!result || typeof result.violations === 'undefined') {
    throw new Error('audit returned: ' + JSON.stringify(result));
  }
});
