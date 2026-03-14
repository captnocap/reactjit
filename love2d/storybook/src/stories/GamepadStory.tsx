/**
 * Gamepad — Controller input, focus groups, and navigation.
 *
 * Live input visualizer + documentation for the gamepad subsystem:
 * button mapping, axis display, focus group cycling, and controls reference.
 *
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState, useRef } from 'react';
import { Box, Text, ScrollView, CodeBlock, Pressable, TextInput, useBridge, useLuaInterval, classifiers as S } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { Band, Half, HeroBand, CalloutBand, Divider, SectionLabel, PageColumn } from './_shared/StoryScaffold';

// -- Palette ----------------------------------------------------------

const C = {
  accent: '#89b4fa',
  accentDim: 'rgba(137, 180, 250, 0.12)',
  buttonOff: '#2a2a3a',
  buttonOn: '#89b4fa',
  axisTrack: '#1e1e2e',
  axisFill: '#a6e3a1',
  axisNeg: '#f38ba8',
  dpadBg: '#313244',
  dpadActive: '#f9e2af',
  green: '#a6e3a1',
  red: '#f38ba8',
  yellow: '#f9e2af',
  mauve: '#cba6f7',
};

// -- Static code blocks (hoisted) -------------------------------------

const INSTALL_CODE = `import { Box, useBridge } from '@reactjit/core';

// Button events — discrete, safe to cross the bridge
<Box
  onGamepadPress={(e) => console.log(e.gamepadButton)}
  onGamepadRelease={(e) => console.log(e.gamepadButton)}
/>

// Axis data — poll from Lua, never event-driven
const bridge = useBridge();
const state = await bridge.rpc('gamepad:state', { joystickId: 1 });
// state.axes: { leftx, lefty, rightx, righty, ... }
// state.buttons: { a, b, dpup, ... }`;

const FOCUS_GROUP_CODE = `// Shoulder buttons cycle between focus groups.
// D-pad navigates within the active group.

<Box focusGroup>
  {/* Group A: sidebar nav */}
  <Pressable onPress={...}>Item 1</Pressable>
  <Pressable onPress={...}>Item 2</Pressable>
</Box>

<Box focusGroup>
  {/* Group B: content area */}
  <Pressable onPress={...}>Action 1</Pressable>
  <Pressable onPress={...}>Action 2</Pressable>
</Box>`;

const BUTTON_MAP_CODE = `-- Built-in button mapping (lua/init.lua)
-- D-pad     → spatial focus navigation
-- A         → click (press + release)
-- B         → Escape
-- Start     → Escape
-- L/R Shoulder → cycle focus groups
-- Left Stick   → focus navigation (with repeat)
-- Right Stick  → scroll nearest ScrollView
-- Other buttons → onGamepadPress broadcast`;

const OSK_CODE = `// The on-screen keyboard opens automatically when you
// press A on a focused TextInput. No setup needed.

<TextInput
  placeholder="Focus me and press A..."
  value={text}
  onTextInputChange={(e) => setText(e.text)}
/>

// The OSK supports:
// - D-pad: navigate keys
// - A: type the selected key
// - B: close the keyboard
// - Shoulder: switch keyboard layout (letters/symbols/numeric)
// - Stick: smooth key navigation`;

const USEIFTTT_CODE = `import { useIFTTT } from '@reactjit/core';

// React to specific gamepad buttons
useIFTTT('gamepad:a', () => jump());
useIFTTT('gamepad:leftshoulder', () => prevTab());
useIFTTT('gamepad:rightshoulder', () => nextTab());`;

// -- Button indicator -------------------------------------------------

function ButtonDot({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <Box style={{ alignItems: 'center', gap: 2, width: 44 }}>
      <Box style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: pressed ? C.buttonOn : C.buttonOff,
        borderWidth: 1,
        borderColor: pressed ? '#74c7ec' : '#45475a',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 9, color: pressed ? '#1e1e2e' : '#6c7086' }}>{label}</Text>
      </Box>
    </Box>
  );
}

// -- Axis bar ---------------------------------------------------------

function AxisBar({ label, value }: { label: string; value: number }) {
  const pct = Math.abs(value) * 100;
  const isNeg = value < 0;
  const fillColor = isNeg ? C.axisNeg : C.axisFill;
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 18, width: '100%' }}>
      <Text style={{ fontSize: 9, color: '#a6adc8', width: 50, textAlign: 'right' }}>{label}</Text>
      <Box style={{
        flexGrow: 1,
        height: 8,
        backgroundColor: C.axisTrack,
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {pct > 0 && (
          <Box style={{ width: `${pct}%`, height: 8, backgroundColor: fillColor, borderRadius: 4 }} />
        )}
      </Box>
      <Text style={{ fontSize: 9, color: '#a6adc8', width: 40 }}>{value.toFixed(2)}</Text>
    </Box>
  );
}

// -- D-pad visual -----------------------------------------------------

function DPad({ buttons }: { buttons: Record<string, boolean> }) {
  const s = (dir: string) => ({
    width: 24,
    height: 24,
    backgroundColor: buttons[dir] ? C.dpadActive : C.dpadBg,
    borderRadius: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  });
  return (
    <Box style={{ alignItems: 'center', gap: 1 }}>
      <Box style={s('dpup')}>
        <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{'\u25B2'}</Text>
      </Box>
      <Box style={{ flexDirection: 'row', gap: 1 }}>
        <Box style={s('dpleft')}>
          <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{'\u25C0'}</Text>
        </Box>
        <Box style={{ width: 24, height: 24 }} />
        <Box style={s('dpright')}>
          <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{'\u25B6'}</Text>
        </Box>
      </Box>
      <Box style={s('dpdown')}>
        <Text style={{ fontSize: 9, color: '#1e1e2e' }}>{'\u25BC'}</Text>
      </Box>
    </Box>
  );
}

// -- Live input panel -------------------------------------------------

const FACE_BUTTONS = ['a', 'b', 'x', 'y'];
const SHOULDER_BUTTONS = ['leftshoulder', 'rightshoulder', 'leftstick', 'rightstick'];
const META_BUTTONS = ['back', 'start', 'guide'];

function LiveInputPanel({ buttons, axes, lastButton }: {
  buttons: Record<string, boolean>;
  axes: Record<string, number>;
  lastButton: string;
}) {
  const c = useThemeColors();
  return (
    <>
      <Box style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
        <Box style={{ gap: 4, alignItems: 'center' }}>
          <S.StoryCap>D-PAD</S.StoryCap>
          <DPad buttons={buttons} />
        </Box>
        <Box style={{ gap: 4, alignItems: 'center' }}>
          <S.StoryCap>FACE</S.StoryCap>
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: 96, justifyContent: 'center' }}>
            {FACE_BUTTONS.map(b => (
              <ButtonDot key={b} label={b.toUpperCase()} pressed={!!buttons[b]} />
            ))}
          </Box>
        </Box>
        <Box style={{ gap: 4, alignItems: 'center' }}>
          <S.StoryCap>SHOULDER</S.StoryCap>
          <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {SHOULDER_BUTTONS.map(b => (
              <ButtonDot key={b} label={b.replace('shoulder', 'SH').replace('stick', 'ST').replace('left', 'L').replace('right', 'R')} pressed={!!buttons[b]} />
            ))}
          </Box>
        </Box>
        <Box style={{ gap: 4, alignItems: 'center' }}>
          <S.StoryCap>META</S.StoryCap>
          <Box style={{ flexDirection: 'row', gap: 4 }}>
            {META_BUTTONS.map(b => (
              <ButtonDot key={b} label={b.slice(0, 3).toUpperCase()} pressed={!!buttons[b]} />
            ))}
          </Box>
        </Box>
      </Box>

      <S.RowCenterG8>
        <S.StoryBody>{'Last button:'}</S.StoryBody>
        <Text style={{ fontSize: 11, color: C.buttonOn, fontWeight: 'bold' }}>{lastButton}</Text>
      </S.RowCenterG8>
    </>
  );
}

// -- Focus group demo -------------------------------------------------

function FocusGroupDemo() {
  const c = useThemeColors();
  const [selected, setSelected] = useState(0);
  const items = ['Item A', 'Item B', 'Item C', 'Item D'];

  return (
    <Box focusGroup style={{
      flexDirection: 'row',
      gap: 4,
      padding: 8,
      backgroundColor: c.surface,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
    }}>
      {items.map((item, i) => (
        <Pressable
          key={item}
          onPress={() => setSelected(i)}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 4,
            backgroundColor: selected === i ? c.primary : c.bgElevated,
          }}
        >
          <Text style={{ fontSize: 10, color: selected === i ? '#1e1e2e' : c.text }}>{item}</Text>
        </Pressable>
      ))}
    </Box>
  );
}

// -- OSK demo ---------------------------------------------------------

function OskDemo() {
  const c = useThemeColors();
  const [text, setText] = useState('');

  const handleTextChange = (e: any) => {
    setText(e.text || '');
  };

  return (
    <Box style={{
      gap: 6,
      padding: 8,
      backgroundColor: c.surface,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
    }}>
      <TextInput
        placeholder="Focus me and press A..."
        value={text}
        onTextInputChange={handleTextChange}
        style={{
          fontSize: 11,
          color: c.text,
          backgroundColor: c.bgElevated,
          borderRadius: 4,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 8,
          paddingBottom: 8,
          borderWidth: 1,
          borderColor: c.border,
        }}
      />
      <Text style={{ fontSize: 9, color: c.muted }}>{`Typed: "${text}"`}</Text>
    </Box>
  );
}

// -- Main story -------------------------------------------------------

export function GamepadStory() {
  const c = useThemeColors();
  const bridge = useBridge();
  const [buttons, setButtons] = useState<Record<string, boolean>>({});
  const [axes, setAxes] = useState<Record<string, number>>({});
  const [lastButton, setLastButton] = useState('(none)');

  const handleGamepadPress = (e: any) => {
    const btn = e.gamepadButton || e.button || '?';
    setButtons(prev => ({ ...prev, [btn]: true }));
    setLastButton(btn);
  };

  const handleGamepadRelease = (e: any) => {
    const btn = e.gamepadButton || e.button || '?';
    setButtons(prev => ({ ...prev, [btn]: false }));
  };

  // Poll gamepad axes from Lua at ~10fps (no axis events cross the bridge)
  const axesRef = useRef<Record<string, number>>({});
  useLuaInterval(100, async () => {
    try {
      const state = await bridge.rpc('gamepad:state', { joystickId: 1 }) as any;
      if (state && state.axes) {
        const next = state.axes as Record<string, number>;
        // Only setState if something actually changed (avoid re-renders)
        const prev = axesRef.current;
        let changed = false;
        for (const k in next) {
          if (Math.abs((prev[k] || 0) - (next[k] || 0)) > 0.01) { changed = true; break; }
        }
        for (const k in prev) {
          if (!(k in next) && Math.abs(prev[k]) > 0.01) { changed = true; break; }
        }
        if (changed) {
          axesRef.current = next;
          setAxes(next);
        }
      }
    } catch (_) { /* bridge not ready yet */ }
  });

  return (
    <S.StoryRoot>

      {/* Header */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="gamepad" tintColor={C.accent} />
        <S.StoryTitle>{'Gamepad'}</S.StoryTitle>
        <Box style={{ backgroundColor: C.accentDim, borderRadius: 4, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3 }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'@reactjit/core'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>{'USB controllers, focus groups, and spatial navigation'}</S.StoryMuted>
      </S.RowCenterBorder>

      {/* Content */}
      <ScrollView style={{ flexGrow: 1 }}>
        <Box
          style={{ width: '100%' }}
          onGamepadPress={handleGamepadPress}
          onGamepadRelease={handleGamepadRelease}
        >
          <PageColumn>

            {/* Hero */}
            <HeroBand accentColor={C.accent}>
              <S.StoryHeadline>{'Plug in a controller and play.'}</S.StoryHeadline>
              <S.StoryBody>
                {'Love2D detects USB gamepads via SDL. D-pad navigates focus, A activates, shoulder buttons cycle focus groups. All input is available as React event handlers.'}
              </S.StoryBody>
            </HeroBand>

            {/* Band 1: EVENT HANDLERS — code | text */}
            <Band>
              <Half>
                <CodeBlock code={INSTALL_CODE} language="tsx" fontSize={9} style={{ width: '100%' }} />
              </Half>
              <Half>
                <SectionLabel icon="radio" accentColor={C.accent}>{'EVENT HANDLERS'}</SectionLabel>
                <S.StoryBody>
                  {'Button events (onGamepadPress, onGamepadRelease) broadcast to any Box. Axis data stays in Lua — poll it via bridge.rpc at your own frame rate.'}
                </S.StoryBody>
              </Half>
            </Band>

            <Divider />

            {/* Band 2: LIVE INPUT — demo | axes */}
            <Band>
              <Half>
                <SectionLabel icon="zap" accentColor={C.yellow}>{'LIVE INPUT'}</SectionLabel>
                <LiveInputPanel buttons={buttons} axes={axes} lastButton={lastButton} />
              </Half>
              <Half>
                <S.StoryCap>{'AXES'}</S.StoryCap>
                <Box style={{ width: '100%', gap: 2 }}>
                  <AxisBar label="Left X" value={axes['leftx'] || 0} />
                  <AxisBar label="Left Y" value={axes['lefty'] || 0} />
                  <AxisBar label="Right X" value={axes['rightx'] || 0} />
                  <AxisBar label="Right Y" value={axes['righty'] || 0} />
                </Box>
                <S.StoryCap>{'TRIGGERS'}</S.StoryCap>
                <Box style={{ width: '100%', gap: 2 }}>
                  <AxisBar label="Trigger L" value={axes['triggerleft'] || 0} />
                  <AxisBar label="Trigger R" value={axes['triggerright'] || 0} />
                </Box>
              </Half>
            </Band>

            <Divider />

            {/* Band 3: BUTTON MAPPING — text | code */}
            <Band>
              <Half>
                <SectionLabel icon="map" accentColor={C.green}>{'BUTTON MAPPING'}</SectionLabel>
                <S.StoryBody>
                  {'D-pad and A/B are consumed by the focus system. Other buttons pass through as onGamepadPress events for custom handling.'}
                </S.StoryBody>
                <CalloutBand borderColor="rgba(137, 180, 250, 0.25)" bgColor="rgba(137, 180, 250, 0.06)">
                  <S.StoryBody>
                    {'Note: L/R shoulder buttons are reserved for focus group cycling. Games that need shoulder buttons should use onGamepadPress and handle them in a custom focus group.'}
                  </S.StoryBody>
                </CalloutBand>
              </Half>
              <Half>
                <CodeBlock code={BUTTON_MAP_CODE} language="lua" fontSize={9} style={{ width: '100%' }} />
              </Half>
            </Band>

            <Divider />

            {/* Band 4: FOCUS GROUPS — code | text + demo */}
            <Band>
              <Half>
                <CodeBlock code={FOCUS_GROUP_CODE} language="tsx" fontSize={9} style={{ width: '100%' }} />
              </Half>
              <Half>
                <SectionLabel icon="layers" accentColor={C.mauve}>{'FOCUS GROUPS'}</SectionLabel>
                <S.StoryBody>
                  {'Add focusGroup to any Box to create a navigation zone. Shoulder buttons cycle between groups. D-pad moves within the active group. Only one group is active at a time.'}
                </S.StoryBody>
                <S.StoryCap>{'TRY IT'}</S.StoryCap>
                <FocusGroupDemo />
              </Half>
            </Band>

            <Divider />

            {/* Band 5: ON-SCREEN KEYBOARD — text + demo | code */}
            <Band>
              <Half>
                <SectionLabel icon="type" accentColor={C.yellow}>{'ON-SCREEN KEYBOARD'}</SectionLabel>
                <S.StoryBody>
                  {'When a TextInput has focus and you press A, the on-screen keyboard opens automatically. D-pad navigates keys, A types, B closes. Shoulder buttons switch layouts.'}
                </S.StoryBody>
                <S.StoryCap>{'TRY IT'}</S.StoryCap>
                <OskDemo />
              </Half>
              <Half>
                <CodeBlock code={OSK_CODE} language="tsx" fontSize={9} style={{ width: '100%' }} />
              </Half>
            </Band>

            <Divider />

            {/* Band 6: useIFTTT — code | text */}
            <Band>
              <Half>
                <CodeBlock code={USEIFTTT_CODE} language="tsx" fontSize={9} style={{ width: '100%' }} />
              </Half>
              <Half>
                <SectionLabel icon="link" accentColor={C.accent}>{'useIFTTT'}</SectionLabel>
                <S.StoryBody>
                  {'For simple button reactions, useIFTTT provides a one-liner pattern. No event object, no handler registration — just trigger and callback.'}
                </S.StoryBody>
              </Half>
            </Band>

          </PageColumn>
        </Box>
      </ScrollView>

    </S.StoryRoot>
  );
}
