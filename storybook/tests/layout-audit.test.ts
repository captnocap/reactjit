// Layout audit — run the full tree and report any clipping/overlap/off-viewport issues.
// Run with:  rjit build && rjit test tests/layout-audit.test.ts

test('storybook has no layout violations', async () => {
  const audit = await page.audit();
  // Log all violations for visibility even if we pass
  if (audit.violations.length > 0) {
    for (const v of audit.violations) {
      console.log(`[${v.severity}] ${v.rule}: ${v.message}`);
    }
  }
  await expect(audit).toHaveNoViolations();
});

test('no child-overflow errors', async () => {
  const audit = await page.audit({ rule: 'child-overflow' });
  await expect(audit).toHaveNoViolations();
});

test('no sibling-overlap warnings', async () => {
  const audit = await page.audit({ rule: 'sibling-overlap' });
  await expect(audit).toHaveNoViolations();
});

test('no off-viewport elements', async () => {
  const audit = await page.audit({ rule: 'off-viewport' });
  await expect(audit).toHaveNoViolations();
});
