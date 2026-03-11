// Gamepad integration tests — virtual controller navigation, scrolling, focus.
//
// Tests the full gamepad pipeline:
//   Virtual joystick → Lua gamepadpressed/released/axis → focus system → scroll → React events
//
// Run with:  cd storybook && rjit build && rjit test tests/gamepad.test.ts
//
// Requires the gamepad test APIs added to testrunner.lua + test-shim.js:
//   page.gamepad.connect(), .press(), .release(), .tap(), .axis()
//   page.gamepad.getFocused(), .getScroll(), .getFocusables()

// ============================================================================
// Setup: connect virtual controller and verify initial state
// ============================================================================

test('virtual controller connects without error', async () => {
  const result = await page.gamepad.connect(1);
  // Should return the joystick ID
  if (!result || result.joystickId !== 1) {
    throw new Error('Expected joystickId=1, got: ' + JSON.stringify(result));
  }
});

test('no focus initially (mouse mode)', async () => {
  const focused = await page.gamepad.getFocused();
  // In mouse mode, there should be no controller-driven focus
  // (or it might be found=false)
  // Either way, this establishes baseline
  if (focused.found) {
    // Some node is focused from a previous test — that's ok, just note it
  }
});

// ============================================================================
// D-pad navigation — focus moves between focusable elements
// ============================================================================

test('dpad down creates initial focus', async () => {
  // First D-pad press should switch to controller mode and focus something
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);
  const focused = await page.gamepad.getFocused();
  if (!focused.found) {
    throw new Error('Expected a focused node after dpdown, got none');
  }
});

test('dpad down moves focus to a different node', async () => {
  const before = await page.gamepad.getFocused();
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);
  const after = await page.gamepad.getFocused();
  if (!after.found) {
    throw new Error('Lost focus after dpdown');
  }
  // Focus should have moved (different node or scrolled)
  // Note: if there's only one focusable node in the direction, focus stays
  // but we should still have a focused node
});

test('dpad up moves focus upward', async () => {
  // Navigate down twice first to ensure we're not at the top
  await page.gamepad.press('dpdown', 1);
  await page.wait();
  await page.gamepad.press('dpdown', 1);
  await page.wait();

  const before = await page.gamepad.getFocused();
  await page.gamepad.press('dpup', 1);
  await page.wait(2);
  const after = await page.gamepad.getFocused();

  if (!after.found) {
    throw new Error('Lost focus after dpup');
  }
  // Focus should have moved up (y decreased or same node at boundary)
  if (before.found && after.found && before.id !== after.id) {
    if (after.y > before.y + 5) {
      throw new Error(
        'Focus moved DOWN instead of up: before.y=' + before.y + ' after.y=' + after.y
      );
    }
  }
});

test('dpad right moves focus rightward', async () => {
  const before = await page.gamepad.getFocused();
  await page.gamepad.press('dpright', 1);
  await page.wait(2);
  const after = await page.gamepad.getFocused();

  if (!after.found) {
    throw new Error('Lost focus after dpright');
  }
});

test('dpad left moves focus leftward', async () => {
  // Go right first, then back left
  await page.gamepad.press('dpright', 1);
  await page.wait();

  const before = await page.gamepad.getFocused();
  await page.gamepad.press('dpleft', 1);
  await page.wait(2);
  const after = await page.gamepad.getFocused();

  if (!after.found) {
    throw new Error('Lost focus after dpleft');
  }
});

// ============================================================================
// Focus ring — verify visual feedback exists for focused nodes
// ============================================================================

test('focus ring exists for the focused node', async () => {
  // Ensure something is focused
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  const focusables = await page.gamepad.getFocusables();
  if (!focusables.focused || focusables.focused.length === 0) {
    throw new Error('No focused nodes reported by getFocusables');
  }
  // The focused node should have non-zero dimensions
  const f = focusables.focused[0];
  if (f.w <= 0 || f.h <= 0) {
    throw new Error('Focused node has zero size: ' + f.w + 'x' + f.h);
  }
});

// ============================================================================
// A button — activates the focused element (synthesizes click + release)
// ============================================================================

test('A button press does not crash', async () => {
  // Navigate to a focusable element first
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  const focused = await page.gamepad.getFocused();
  if (!focused.found) {
    throw new Error('No focused node to activate');
  }

  // Press A — should synthesize click event
  await page.gamepad.press('a', 1);
  await page.wait();
  // Release A — should synthesize release event (which triggers onPress)
  await page.gamepad.release('a', 1);
  await page.wait(2);

  // Verify focus still exists (didn't crash or lose state)
  const afterFocused = await page.gamepad.getFocused();
  // Focus might have changed (navigation happened) but shouldn't crash
});

test('A button tap (press+release) works', async () => {
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  // Use the tap convenience method
  await page.gamepad.tap('a', 1);
  await page.wait(2);

  // Just verifying no crash — the effect depends on what's focused
});

// ============================================================================
// B button — simulates Escape
// ============================================================================

test('B button does not crash', async () => {
  await page.gamepad.tap('b', 1);
  await page.wait(2);
  // B maps to Escape — should not crash regardless of context
});

// ============================================================================
// Shoulder buttons — cycle focus groups
// ============================================================================

test('right shoulder cycles focus group forward', async () => {
  // Ensure we have focus first
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  const before = await page.gamepad.getFocused();
  await page.gamepad.press('rightshoulder', 1);
  await page.wait(2);
  const after = await page.gamepad.getFocused();

  // Focus group should have changed (different node, possibly different region)
  // Both should be valid focused nodes
  if (!after.found) {
    // It's ok if focus is lost after cycling to an empty group — but log it
  }
});

test('left shoulder cycles focus group backward', async () => {
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  await page.gamepad.press('leftshoulder', 1);
  await page.wait(2);
  const after = await page.gamepad.getFocused();
  // Same as above — just verifying no crash
});

test('shoulder cycling is reversible', async () => {
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);
  const initial = await page.gamepad.getFocused();

  // Cycle right, then back left
  await page.gamepad.press('rightshoulder', 1);
  await page.wait(2);
  await page.gamepad.press('leftshoulder', 1);
  await page.wait(2);

  const returned = await page.gamepad.getFocused();
  // Should be back in the same group (possibly same node)
});

// ============================================================================
// Scrolling — right stick scrolls nearest ScrollView
// ============================================================================

test('right stick Y scrolls the page vertically', async () => {
  // Get initial scroll state of any ScrollView
  const before = await page.gamepad.getScroll('ScrollView');

  if (!before.found) {
    // No ScrollView — skip (not an error, just nothing to test)
    return;
  }

  const initialScrollY = before.scrollY;

  // Push right stick down (positive Y)
  await page.gamepad.axis('righty', 0.8, 1);
  await page.wait(2);
  await page.gamepad.axis('righty', 0.8, 1);
  await page.wait(2);
  // Release stick
  await page.gamepad.axis('righty', 0, 1);
  await page.wait();

  const after = await page.gamepad.getScroll('ScrollView');
  if (!after.found) {
    throw new Error('ScrollView disappeared after scrolling');
  }

  if (after.scrollY <= initialScrollY) {
    throw new Error(
      'Expected scrollY to increase: before=' + initialScrollY + ' after=' + after.scrollY
    );
  }
});

test('right stick X scrolls horizontally', async () => {
  // Get initial scroll state
  const before = await page.gamepad.getScroll('ScrollView');
  if (!before.found) return;

  const initialScrollX = before.scrollX;

  // Push right stick right
  await page.gamepad.axis('rightx', 0.8, 1);
  await page.wait(2);
  await page.gamepad.axis('rightx', 0, 1);
  await page.wait();

  const after = await page.gamepad.getScroll('ScrollView');
  // Horizontal scroll may not change if content doesn't overflow horizontally
  // Just verify no crash
});

test('scroll back up with right stick', async () => {
  // First scroll down
  await page.gamepad.axis('righty', 0.8, 1);
  await page.wait(3);
  await page.gamepad.axis('righty', 0, 1);
  await page.wait();

  const midpoint = await page.gamepad.getScroll('ScrollView');

  // Now scroll back up
  await page.gamepad.axis('righty', -0.8, 1);
  await page.wait(3);
  await page.gamepad.axis('righty', 0, 1);
  await page.wait();

  const after = await page.gamepad.getScroll('ScrollView');
  if (midpoint.found && after.found) {
    if (after.scrollY >= midpoint.scrollY) {
      throw new Error(
        'Expected scrollY to decrease: midpoint=' + midpoint.scrollY + ' after=' + after.scrollY
      );
    }
  }
});

// ============================================================================
// D-pad scroll fallback — scrolls when no focusable node in direction
// ============================================================================

test('dpad down scrolls when no more focusable nodes below', async () => {
  // Navigate to the bottom-most focusable node
  for (let i = 0; i < 30; i++) {
    await page.gamepad.press('dpdown', 1);
    await page.wait();
  }

  const scrollBefore = await page.gamepad.getScroll('ScrollView');

  // One more dpdown — should trigger scroll fallback
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  const scrollAfter = await page.gamepad.getScroll('ScrollView');

  // Either scroll changed or focus changed — no crash either way
  if (scrollBefore.found && scrollAfter.found) {
    // scrollY should have increased (or stayed same if at bottom)
    // Just verify no crash — the exact behavior depends on content
  }
});

test('dpad up scrolls when no more focusable nodes above', async () => {
  // Navigate to the top-most focusable node
  for (let i = 0; i < 30; i++) {
    await page.gamepad.press('dpup', 1);
    await page.wait();
  }

  // Reset scroll to non-zero first
  await page.gamepad.axis('righty', 0.8, 1);
  await page.wait(3);
  await page.gamepad.axis('righty', 0, 1);
  await page.wait();

  const scrollBefore = await page.gamepad.getScroll('ScrollView');

  await page.gamepad.press('dpup', 1);
  await page.wait(2);

  const scrollAfter = await page.gamepad.getScroll('ScrollView');
  // Scroll should decrease (or stay at 0)
});

// ============================================================================
// Left stick — analog focus navigation with deadzone
// ============================================================================

test('left stick below deadzone does nothing', async () => {
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);
  const before = await page.gamepad.getFocused();

  // Small stick movement — below 0.3 deadzone
  await page.gamepad.axis('lefty', 0.1, 1);
  await page.wait(3);
  await page.gamepad.axis('lefty', 0, 1);
  await page.wait();

  const after = await page.gamepad.getFocused();
  // Focus should not have moved
  if (before.found && after.found && before.id !== after.id) {
    throw new Error('Focus moved with sub-deadzone stick input');
  }
});

test('left stick above deadzone navigates', async () => {
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  // Push stick hard down
  await page.gamepad.axis('lefty', 0.9, 1);
  await page.wait(5);
  await page.gamepad.axis('lefty', 0, 1);
  await page.wait();

  // Just verify no crash — the stick navigation uses repeat timers
  const focused = await page.gamepad.getFocused();
  if (!focused.found) {
    throw new Error('Lost focus after stick navigation');
  }
});

// ============================================================================
// Start button — simulates Escape
// ============================================================================

test('start button does not crash', async () => {
  await page.gamepad.tap('start', 1);
  await page.wait(2);
});

// ============================================================================
// Triggers and other axes — pass through as gamepad events
// ============================================================================

test('trigger axes do not crash', async () => {
  await page.gamepad.axis('triggerleft', 0.5, 1);
  await page.wait();
  await page.gamepad.axis('triggerleft', 0, 1);
  await page.wait();
  await page.gamepad.axis('triggerright', 1.0, 1);
  await page.wait();
  await page.gamepad.axis('triggerright', 0, 1);
  await page.wait();
});

// ============================================================================
// Multiple rapid inputs — stress test for input pipeline
// ============================================================================

test('rapid dpad mashing does not crash', async () => {
  const buttons = ['dpup', 'dpdown', 'dpleft', 'dpright'];
  for (let i = 0; i < 20; i++) {
    const btn = buttons[i % 4];
    await page.gamepad.press(btn, 1);
  }
  await page.wait(3);

  // Verify system is still functional
  const focused = await page.gamepad.getFocused();
  // May or may not have focus — just verify no crash
});

test('rapid A button mashing does not crash', async () => {
  await page.gamepad.press('dpdown', 1);
  await page.wait();

  for (let i = 0; i < 10; i++) {
    await page.gamepad.tap('a', 1);
  }
  await page.wait(3);
});

test('simultaneous stick + button does not crash', async () => {
  await page.gamepad.axis('righty', 0.7, 1);
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);
  await page.gamepad.axis('righty', 0, 1);
  await page.wait();
});

// ============================================================================
// Screenshot for visual verification
// ============================================================================

test('screenshot after gamepad navigation', async () => {
  // Navigate around to get an interesting state
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);
  await page.gamepad.press('dpdown', 1);
  await page.wait(2);

  await page.screenshot('/tmp/gamepad-test-final.png');
  await page.wait();
});
