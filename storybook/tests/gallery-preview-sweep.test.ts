// Gallery preview sweep — render every component, report each one individually.
//
// The old version wrapped 61 checks in 1 test() block. The runner saw "0 passed,
// 1 failed (1 test)" — hiding that 60 components actually worked. Now each
// component emits its own TEST_PASS/TEST_FAIL through bridge RPC, so the runner
// reports the truth: "60 passed, 1 failed (61 tests)".
//
// Run:
//   cd storybook && rjit build && rjit test tests/gallery-preview-sweep.test.ts --timeout=300 --visible -v

test('Gallery preview sweep', async () => {
  const bridge = (globalThis as any).__rjitBridge;

  // ── Intercept console.error to catch JS errors the error boundary swallows ──
  const jsErrors: string[] = [];
  const origError = console.error;
  console.error = (...args: any[]) => {
    jsErrors.push(args.map(String).join(' '));
    origError(...args);
  };

  // Navigate to the Component Gallery story
  const nav = (globalThis as any).__navigateToStory;
  if (typeof nav !== 'function') throw new Error('__navigateToStory not found');
  nav('gallery');
  await page.wait(10);

  // Get component list + setter from GalleryStory
  const entries = (globalThis as any).__galleryEntries as Array<{ id: string; label: string }>;
  const setActive = (globalThis as any).__gallerySetActive as (id: string) => void;
  if (!entries || !setActive) throw new Error('Gallery not loaded — __galleryEntries or __gallerySetActive missing');

  let totalPassed = 0;
  let totalFailed = 0;
  const total = entries.length;

  for (let i = 0; i < total; i++) {
    const entry = entries[i];
    const testName = `Gallery/${entry.label}`;
    console.log(`[${i + 1}/${total}] ${entry.label}...`);

    // Clear error buffer before each component
    jsErrors.length = 0;

    try {
      setActive(entry.id);
      await page.wait(5);

      // ── Check 1: Error boundary crash overlay ──
      const crashNodes = await page.find('Text', { children: 'Story Crashed' }).all();
      if (crashNodes.length > 0) {
        await bridge.rpc('test:emit', { name: testName, passed: false, error: 'Story Crashed' });
        totalFailed++;
        await page.screenshot(`/tmp/gallery_fail_${entry.id}.png`);
        continue;
      }

      // ── Check 2: JS console errors during render ──
      const realErrors = jsErrors.filter((e: string) =>
        e.includes('The above error occurred') ||
        (e.includes('[ERROR]') && !e.includes('Warning:'))
      );
      if (realErrors.length > 0) {
        const firstErr = realErrors[0].slice(0, 120);
        await bridge.rpc('test:emit', { name: testName, passed: false, error: `console.error: ${firstErr}` });
        totalFailed++;
        await page.screenshot(`/tmp/gallery_fail_${entry.id}.png`);
        continue;
      }

      // Passed
      await bridge.rpc('test:emit', { name: testName, passed: true });
      totalPassed++;

    } catch (e: any) {
      const msg = (e?.message || String(e)).slice(0, 150);
      await bridge.rpc('test:emit', { name: testName, passed: false, error: msg });
      totalFailed++;
      await page.screenshot(`/tmp/gallery_fail_${entry.id}.png`);
    }
  }

  // Restore console.error
  console.error = origError;

  console.log(`\nSweep complete: ${totalPassed} pass, ${totalFailed} fail (${total} total)`);

  // Don't throw — individual results are already emitted.
  // The outer test passes silently; the real results are the per-component ones.
});
