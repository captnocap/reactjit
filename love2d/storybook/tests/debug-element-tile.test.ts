test('ElementTile debug', async () => {
  const bridge = (globalThis as any).__rjitBridge;
  const nav = (globalThis as any).__navigateToStory;
  if (typeof nav !== 'function') throw new Error('__navigateToStory not found');
  nav('gallery');
  await page.wait(5);

  const setActive = (globalThis as any).__gallerySetActive as (id: string) => void;
  if (!setActive) throw new Error('__gallerySetActive not found');

  setActive('elementtile');
  await page.wait(10);

  // Query the tree for ElementTile nodes
  const tiles = await page.find('ElementTile').all();
  console.log(`Found ${tiles.length} ElementTile nodes`);

  // Also check for any node type
  const allNodes = await bridge.rpc('tree:query', { type: 'ElementTile' });
  console.log('tree:query result:', JSON.stringify(allNodes));

  await page.screenshot('/tmp/elementtile_debug.png');
  console.log('Screenshot saved to /tmp/elementtile_debug.png');
});
