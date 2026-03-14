// Syntax tokenizer regression test — catches infinite loops in comment handling.
//
// The bug: tokenizeJS (and every other language tokenizer) used `break` to exit
// a `repeat...until true` block after consuming a comment, but never advanced `i`.
// The outer `while i <= len` re-entered and re-matched the same comment forever,
// allocating a new table each iteration until OOM.
//
// This test navigates to the Syntax Stress story which renders 16 CodeBlocks
// (one per language), each containing comment syntax that triggers the fixed paths.
// If any tokenizer regresses, the app hangs and this test times out.
//
// Run:  cd storybook && rjit build && rjit test tests/syntax-tokenizer.test.ts

test('navigate to Syntax Stress story', async () => {
  const bridge = (globalThis as any).__rjitBridge;

  // Resize to a tall window so the full sidebar fits without scrolling.
  // "Syntax Stress" is deep in the list — at 600px it's off-screen/clipped.
  await bridge.rpc('window:setSize', { width: 400, height: 3000 });
  await page.wait(4);

  // In compact mode (width < 640) the sidebar is behind a hamburger. Open it.
  try {
    const hamburger = page.find('Text', { children: '\u2630' });
    await hamburger.click();
    await page.wait(2);
  } catch {
    // Non-compact: sidebar is always visible, no hamburger
  }

  // All story entries are now in-viewport — click Syntax Stress.
  const entry = page.find('Text', { children: 'Syntax Stress' });
  await entry.click();
  await page.wait(5);

  // Restore window to a reasonable size for the remaining tests.
  await bridge.rpc('window:setSize', { width: 800, height: 600 });
  await page.wait(4);
});

test('all 16 language labels render (no tokenizer hang)', async () => {
  const langs = ['js', 'ts', 'tsx', 'python', 'lua', 'ruby', 'css', 'html',
                 'rust', 'go', 'c', 'java', 'sql', 'swift', 'yaml', 'json'];

  for (const lang of langs) {
    const label = page.find('Text', { children: lang });
    await expect(label).toBeVisible();
  }
});

test('CodeBlocks with // comments render (JS/TS/TSX)', async () => {
  // These were the original crash triggers
  const blocks = await page.find('CodeBlock').all();
  // We should have at least 16 CodeBlocks (one per language)
  if (blocks.length < 16) {
    throw new Error(`Expected 16+ CodeBlocks, found ${blocks.length}`);
  }
});

test('screenshot for visual verification', async () => {
  await page.screenshot('/tmp/syntax-stress.png');
});
