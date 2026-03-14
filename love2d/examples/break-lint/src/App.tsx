import React, { useState } from 'react';
import { Box, Text, Pressable, Image, FlexRow, FlexColumn, ScrollView, usePixelArt } from '@reactjit/core';

/**
 * LINT RULE BREAKER — Every section intentionally violates a specific lint rule.
 * Build with: rjit build --no-lint
 * Then visually inspect whether the layout engine actually handles these cases now.
 */

// ── Color palette ──────────────────────────────────────────
const C = {
  bg: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#3b82f6',
  accentHover: '#60a5fa',
  green: '#22c55e',
  red: '#ef4444',
  yellow: '#eab308',
  purple: '#a855f7',
  orange: '#f97316',
  border: '#475569',
};

// ── Section wrapper ────────────────────────────────────────
function Section({ label, rule, children }: {
  label: string;
  rule: string;
  children: React.ReactNode;
}) {
  return (
    <Box style={{
      backgroundColor: C.surface,
      borderRadius: 8,
      padding: 12,
      gap: 8,
      borderWidth: 1,
      borderColor: C.border,
    }}>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center', width: '100%' }}>
        <Text style={{ color: C.accent, fontSize: 11, fontWeight: '700' }}>
          {rule}
        </Text>
        <Text style={{ color: C.muted, fontSize: 10 }}>
          {label}
        </Text>
      </Box>
      {children}
    </Box>
  );
}

// ── Inline PixelArt icon test ──────────────────────────────
// Tests if Text + PixelArt(Box grid) + Text can flow inline in a row
function InlineIconTest() {
  const play = usePixelArt('play', { size: 2, color: C.green });
  const check = usePixelArt('check', { size: 2, color: C.green });
  const heart = usePixelArt('heart', { size: 2, color: C.red });
  const star = usePixelArt('star', { size: 2, color: C.yellow });
  const pause = usePixelArt('pause', { size: 2, color: C.orange });

  return (
    <Box style={{ gap: 6 }}>
      {/* Test 1: Text + icon + Text in a row */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 12 }}>Click</Text>
        {play}
        <Text style={{ color: C.text, fontSize: 12 }}>to start playback</Text>
      </Box>

      {/* Test 2: Multiple icons inline with text */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 12 }}>Status:</Text>
        {check}
        <Text style={{ color: C.text, fontSize: 12 }}>complete</Text>
        {heart}
        <Text style={{ color: C.text, fontSize: 12 }}>saved</Text>
        {star}
        <Text style={{ color: C.text, fontSize: 12 }}>starred</Text>
      </Box>

      {/* Test 3: Icon at start and end */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {pause}
        <Text style={{ color: C.text, fontSize: 12 }}>Paused — press to resume</Text>
        {play}
      </Box>

      {/* Test 4: Just icons in a row (no text) */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {play}
        {pause}
        {check}
        {heart}
        {star}
      </Box>
    </Box>
  );
}

export function App() {
  const [count, setCount] = useState(0);
  const name = 'World';
  const temp = 72;

  return (
    <Box style={{
      width: '100%',
      height: '100%',
      backgroundColor: C.bg,
      padding: 16,
      gap: 12,
    }}>
      {/* Header */}
      <Box style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: C.text, fontSize: 22, fontWeight: '700' }}>
          Lint Rule Breaker
        </Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>
          Every section violates a lint rule. Does the layout still work?
        </Text>
      </Box>

      <ScrollView style={{ flexGrow: 1 }}>
        <Box style={{ gap: 12, padding: 4 }}>

          {/* ════════════════════════════════════════════════════
              RULE 1: no-text-without-fontsize
              Text elements with NO fontSize at all
              ════════════════════════════════════════════════════ */}
          <Section label="Text without fontSize" rule="no-text-without-fontsize">
            <Text style={{ color: C.text }}>
              This text has NO fontSize — does it still measure and render?
            </Text>
            <Text style={{ color: C.green }}>
              Second line, also no fontSize. Does auto-sizing work?
            </Text>
            <Text>
              Bare text — no style at all. What happens?
            </Text>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 2: no-unicode-symbol-in-text
              Unicode symbols that "won't render in Love2D"
              ════════════════════════════════════════════════════ */}
          <Section label="Unicode symbols in Text" rule="no-unicode-symbol-in-text">
            <Text style={{ color: C.text, fontSize: 14 }}>
              Arrows: ← ↑ → ↓ ⇒ ⇐
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Geometric: ■ □ ▲ ▶ ● ○ ◆ ◇
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Dingbats: ✓ ✗ ✦ ✧ ✶ ✸
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Block: █ ▀ ▄ ▌ ▐ ░ ▒ ▓
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Misc: ☀ ♠ ♣ ♥ ♦ ⭐ ⬛ ⬜
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Math: ∞ ≤ ≥ ≠ ± × ÷
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Tech: ⌘ ⏎ ⏸ ⏹ ⏺ ⏭ ⏮
            </Text>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 3: no-mixed-text-children
              Mixed text + expressions (not template literals)
              ════════════════════════════════════════════════════ */}
          <Section label="Mixed text + expressions" rule="no-mixed-text-children">
            <Text style={{ color: C.text, fontSize: 14 }}>
              Hello {name}! Welcome back.
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Count is {count} right now.
            </Text>
            <Text style={{ color: C.text, fontSize: 14 }}>
              Temperature: {temp}°F outside today.
            </Text>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 4: no-row-justify-without-width
              Row with justifyContent but no explicit width
              ════════════════════════════════════════════════════ */}
          <Section label="Row + justifyContent, no width" rule="no-row-justify-without-width">
            <Box style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: C.surfaceAlt,
              padding: 8,
              borderRadius: 4,
            }}>
              <Text style={{ color: C.green, fontSize: 12 }}>Left</Text>
              <Text style={{ color: C.yellow, fontSize: 12 }}>Center</Text>
              <Text style={{ color: C.red, fontSize: 12 }}>Right</Text>
            </Box>
            <Box style={{
              flexDirection: 'row',
              justifyContent: 'center',
              backgroundColor: C.surfaceAlt,
              padding: 8,
              borderRadius: 4,
            }}>
              <Text style={{ color: C.purple, fontSize: 12 }}>Centered without width?</Text>
            </Box>
            <Box style={{
              flexDirection: 'row',
              justifyContent: 'space-evenly',
              backgroundColor: C.surfaceAlt,
              padding: 8,
              borderRadius: 4,
            }}>
              <Text style={{ color: C.accent, fontSize: 12 }}>A</Text>
              <Text style={{ color: C.accent, fontSize: 12 }}>B</Text>
              <Text style={{ color: C.accent, fontSize: 12 }}>C</Text>
              <Text style={{ color: C.accent, fontSize: 12 }}>D</Text>
            </Box>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 5: no-flexrow-flexcolumn
              Using FlexRow and FlexColumn instead of Box
              ════════════════════════════════════════════════════ */}
          <Section label="FlexRow and FlexColumn usage" rule="no-flexrow-flexcolumn">
            <FlexRow style={{ gap: 8 }}>
              <Box style={{ width: 40, height: 40, backgroundColor: C.red, borderRadius: 4 }} />
              <Box style={{ width: 40, height: 40, backgroundColor: C.green, borderRadius: 4 }} />
              <Box style={{ width: 40, height: 40, backgroundColor: C.accent, borderRadius: 4 }} />
            </FlexRow>
            <FlexColumn style={{ gap: 4 }}>
              <Text style={{ color: C.text, fontSize: 12 }}>FlexColumn line 1</Text>
              <Text style={{ color: C.text, fontSize: 12 }}>FlexColumn line 2</Text>
              <Text style={{ color: C.text, fontSize: 12 }}>FlexColumn line 3</Text>
            </FlexColumn>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 6: no-uncontexted-flexgrow
              flexGrow where siblings lack explicit sizing
              ════════════════════════════════════════════════════ */}
          <Section label="flexGrow without sibling sizing" rule="no-uncontexted-flexgrow">
            <Box style={{
              flexDirection: 'row',
              height: 60,
              width: '100%',
              gap: 4,
            }}>
              <Box style={{ flexGrow: 1, backgroundColor: C.red, borderRadius: 4 }} />
              <Box style={{ flexGrow: 1, backgroundColor: C.green, borderRadius: 4 }} />
              <Box style={{ flexGrow: 1, backgroundColor: C.accent, borderRadius: 4 }} />
            </Box>
            <Box style={{ height: 80, width: '100%', gap: 4 }}>
              <Box style={{ flexGrow: 1, backgroundColor: C.purple, borderRadius: 4 }} />
              <Box style={{ flexGrow: 2, backgroundColor: C.orange, borderRadius: 4 }} />
            </Box>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 7: no-deep-flex-nesting
              6+ levels of flex containers without explicit dims
              ════════════════════════════════════════════════════ */}
          <Section label="Deep flex nesting (6+ levels)" rule="no-deep-flex-nesting">
            <Box style={{ backgroundColor: '#1e3a5f', padding: 4, borderRadius: 4 }}>
              <Box style={{ backgroundColor: '#2d1b4e', padding: 4, borderRadius: 4 }}>
                <Box style={{ backgroundColor: '#1b4332', padding: 4, borderRadius: 4 }}>
                  <Box style={{ backgroundColor: '#4a1942', padding: 4, borderRadius: 4 }}>
                    <Box style={{ backgroundColor: '#3d2b1f', padding: 4, borderRadius: 4 }}>
                      <Box style={{ backgroundColor: '#1a3636', padding: 4, borderRadius: 4 }}>
                        <Box style={{ backgroundColor: '#4a3728', padding: 4, borderRadius: 4 }}>
                          <Box style={{ backgroundColor: '#2b1055', padding: 4, borderRadius: 4 }}>
                            <Text style={{ color: C.yellow, fontSize: 12 }}>
                              8 levels deep — no explicit sizes anywhere
                            </Text>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 8: no-implicit-container-sizing
              >10 children without explicit container dimensions
              ════════════════════════════════════════════════════ */}
          <Section label=">10 children, no container size" rule="no-implicit-container-sizing">
            <Box style={{ gap: 2 }}>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 1</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 2</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 3</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 4</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 5</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 6</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 7</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 8</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 9</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 10</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 11</Text>
              <Text style={{ color: C.text, fontSize: 11 }}>Child 12</Text>
            </Box>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 9: no-pressable-without-onpress
              Pressable with no onPress handler
              ════════════════════════════════════════════════════ */}
          <Section label="Pressable without onPress" rule="no-pressable-without-onpress">
            <Pressable style={{
              backgroundColor: C.accent,
              padding: 10,
              borderRadius: 6,
              alignItems: 'center',
            }}>
              <Text style={{ color: C.text, fontSize: 13, fontWeight: '700' }}>
                I am pressable but do nothing
              </Text>
            </Pressable>
          </Section>

          {/* ════════════════════════════════════════════════════
              RULE 10: no-image-without-src
              Image without src prop
              ════════════════════════════════════════════════════ */}
          <Section label="Image without src" rule="no-image-without-src">
            <Box style={{
              height: 60,
              backgroundColor: C.surfaceAlt,
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Image style={{ width: 50, height: 50 }} />
              <Text style={{ color: C.muted, fontSize: 10 }}>
                Image above has no src
              </Text>
            </Box>
          </Section>

          {/* ════════════════════════════════════════════════════
              THEORY TEST A: Inline PixelArt replacing Unicode
              Can Text + PixelArt icon + Text flow inline in a row?
              ════════════════════════════════════════════════════ */}
          <Section label="Inline pixelart replacing unicode" rule="THEORY: inline-pixelart">
            <InlineIconTest />
          </Section>

          {/* ════════════════════════════════════════════════════
              THEORY TEST B: Mixed text — does collectTextContent
              in layout.lua already concatenate __TEXT__ children?
              Comparing broken (raw mixed) vs working (template literal)
              ════════════════════════════════════════════════════ */}
          <Section label="Mixed text side-by-side comparison" rule="THEORY: mixed-text-fix">
            <Text style={{ color: C.muted, fontSize: 10 }}>
              {`BROKEN (mixed children — 3 separate __TEXT__ nodes):`}
            </Text>
            <Box style={{ backgroundColor: C.surfaceAlt, padding: 8, borderRadius: 4 }}>
              <Text style={{ color: C.text, fontSize: 14 }}>
                Hello {name}! Welcome back.
              </Text>
            </Box>
            <Text style={{ color: C.muted, fontSize: 10 }}>
              {`WORKING (template literal — 1 __TEXT__ node):`}
            </Text>
            <Box style={{ backgroundColor: C.surfaceAlt, padding: 8, borderRadius: 4 }}>
              <Text style={{ color: C.text, fontSize: 14 }}>
                {`Hello ${name}! Welcome back.`}
              </Text>
            </Box>
            <Text style={{ color: C.muted, fontSize: 10 }}>
              {`If both look the same, collectTextContent() already concatenates.`}
            </Text>
            <Text style={{ color: C.muted, fontSize: 10 }}>
              {`If "BROKEN" has stacked/overlapping text, __TEXT__ nodes get separate flex slots.`}
            </Text>
          </Section>

        </Box>
      </ScrollView>

      {/* Footer */}
      <Box style={{ alignItems: 'center', paddingTop: 8 }}>
        <Text style={{ color: C.surfaceAlt, fontSize: 10 }}>
          {`Built with --no-lint | ${10} rules broken`}
        </Text>
      </Box>
    </Box>
  );
}
