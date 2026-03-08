// Diagnostic: find "Put that there" text specifically
test('find ready text', async () => {
  await page.wait(8);
  await page.find('Text', { children: 'Layout' }).click();
  await page.wait(20);

  // Check all text for "Put"
  const allText = await page.find('Text').all();
  const texts = allText.map((n: any) => ({
    text: (n.text || '').trim(),
    x: Math.round(n.x), y: Math.round(n.y),
    w: Math.round(n.w), h: Math.round(n.h),
  }));

  const putTexts = texts.filter(t => t.text.includes('Put'));
  const footerTexts = texts.filter(t => t.text.includes('Core') || t.text.includes('/'));
  const layoutSpecific = texts.filter(t =>
    t.text === 'SPACING' || t.text === 'Layout' || t.text.includes('flexDirection')
  );

  throw new Error(
    'total=' + texts.length +
    ' put=' + JSON.stringify(putTexts) +
    ' footer=' + JSON.stringify(footerTexts.slice(0, 5)) +
    ' layout=' + JSON.stringify(layoutSpecific.slice(0, 3))
  );
});
