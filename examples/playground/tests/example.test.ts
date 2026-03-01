// Example spec for rjit test
//
// Globals: test(), page, expect()  — injected by the test shim, no imports needed.
// Run with:  rjit build && rjit test tests/example.test.ts
//
// Selectors: find by component debugName + optional prop match.
//   page.find('Pressable', { testId: 'submit' })
//   page.find('Text')
//   page.find('TextInput', { placeholder: 'Search...' })

test('playground renders a code editor', async () => {
  // Check a known UI element exists and is visible
  const editor = page.find('Box', { testId: 'code-editor' });
  await expect(editor).toBeFound();
  await expect(editor).toBeVisible();
});

test('playground renders a preview pane', async () => {
  const preview = page.find('Box', { testId: 'preview' });
  await expect(preview).toBeFound();
});

// To test interactions:
//
// test('typing updates the editor', async () => {
//   const input = page.find('TextInput');
//   await input.type('Hello');
//   const text = page.find('Text', { testId: 'output' });
//   await expect(text).toContainText('Hello');
// });
//
// test('clicking a button works', async () => {
//   const btn = page.find('Pressable', { testId: 'run' });
//   await btn.click();
//   await page.wait();  // extra frame if needed
//   await expect(page.find('Text', { testId: 'result' })).toHaveText('ok');
// });
