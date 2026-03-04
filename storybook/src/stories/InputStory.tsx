/**
 * Input — Layout1 documentation page.
 *
 * Covers ALL user input primitives: Pressable, Slider, Switch,
 * Checkbox, Radio, Select, TextInput, TextEditor, Modal,
 * useHotkey, useClipboard.
 *
 * Each demo section is its own component so state changes
 * (e.g. dragging a slider) only re-render that section.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Text, Image, TextEditor, TextInput, CodeBlock, Pressable, ScrollView,
  Slider, Switch, Checkbox, RadioGroup, Radio, Select, Modal,
  useHotkey, useClipboard,
} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { transformJSX } from '../playground/lib/jsx-transform';
import { evalComponent } from '../playground/lib/eval-component';
import { Preview } from '../playground/Preview';

// ── Syntax colors ────────────────────────────────────────

const SYN = {
  tag: '#f38ba8',
  component: '#89b4fa',
  prop: '#cba6f7',
  value: '#f9e2af',
};

// ── Helpers ──────────────────────────────────────────────

function HorizontalDivider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <Box style={{ width: 1, flexShrink: 0, alignSelf: 'stretch', backgroundColor: c.border }} />;
}

// ── Static data ──────────────────────────────────────────

const USAGE_CODE = `import {
  Pressable, Slider, Switch, Checkbox,
  RadioGroup, Radio, Select, TextInput,
  TextEditor, Modal, useHotkey, useClipboard,
} from '@reactjit/core';

// Button
<Pressable onPress={() => alert('hi')}>
  <Text fontSize={13}>Press me</Text>
</Pressable>

// Slider
<Slider value={v} onValueChange={setV} />

// Switch
<Switch value={on} onValueChange={setOn} />

// TextInput
<TextInput value={t} onChangeText={setT}
  placeholder="Type..." style={{ width: 200 }} />`;

const STARTER_CODE = `<Box style={{
  backgroundColor: '#1e293b',
  borderRadius: 10,
  padding: 20,
  gap: 12,
  width: 320,
}}>
  <Text style={{ color: '#94a3b8', fontSize: 11 }}>
    Settings Form
  </Text>
  <TextInput
    placeholder="Display name"
    style={{ width: '100%' }}
    textStyle={{ fontSize: 13, color: '#e2e8f0' }}
  />
  <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
    <Switch value={false} />
    <Text style={{ color: '#e2e8f0', fontSize: 12 }}>
      Dark mode
    </Text>
  </Box>
  <Slider value={0.7} style={{ width: '100%' }} />
  <Pressable style={{
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    paddingLeft: 16, paddingRight: 16,
    paddingTop: 8, paddingBottom: 8,
    alignItems: 'center',
  }}>
    <Text style={{ color: '#fff', fontSize: 13 }}>
      Save
    </Text>
  </Pressable>
</Box>`;

// Components — [name, description, icon]
const COMPONENTS: [string, string, string][] = [
  ['Pressable', 'Touch/click target with press/hover/disabled states', 'mouse-pointer-click'],
  ['Slider', 'Draggable track with value, min, max, step', 'sliders-horizontal'],
  ['Switch', 'Boolean toggle with track + thumb', 'toggle-left'],
  ['Checkbox', 'Labeled boolean with check/indeterminate', 'check-square'],
  ['RadioGroup + Radio', 'Single-select from a set of options', 'circle-dot'],
  ['Select', 'Dropdown picker with options array', 'chevrons-up-down'],
  ['TextInput', 'Single/multiline text field, cursor, selection', 'text-cursor-input'],
  ['TextEditor', 'Code editor with syntax highlighting', 'code'],
  ['Modal', 'Overlay dialog with backdrop dismiss', 'panel-top'],
];

// Hooks — [name, signature, icon]
const HOOKS: [string, string, string][] = [
  ['useHotkey', "(combo: string, cb) => void", 'keyboard'],
  ['useClipboard', '() => { copy, paste, copied }', 'clipboard'],
];

const BEHAVIOR_NOTES = [
  'Pressable style can be a function: ({pressed, hovered}) => Style.',
  'Slider needs explicit width in style. Supports min/max/step.',
  'TextInput needs explicit width. onChangeText fires on blur/submit only.',
  'useHotkey combos: "ctrl+z", "ctrl+shift+s", "escape". Global scope.',
  'Modal renders above all content. onRequestClose fires on backdrop tap or Escape.',
];

// Select options (hoisted)
const SELECT_FRUIT_OPTIONS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
];

// ── Isolated demo sections ───────────────────────────────

function PressableDemo() {
  const c = useThemeColors();
  const [pressCount, setPressCount] = useState(0);

  return (
    <>
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'PRESSABLE'}</Text>
      <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          onPress={() => setPressCount(v => v + 1)}
          style={({ pressed, hovered }) => ({
            backgroundColor: pressed ? '#2563eb' : hovered ? '#3b82f6' : c.primary,
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 7, paddingBottom: 7,
            borderRadius: 6,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 11 }}>{'Press me'}</Text>
        </Pressable>
        <Pressable
          disabled
          onPress={() => {}}
          style={{
            backgroundColor: c.surface,
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 7, paddingBottom: 7,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 11 }}>{'Disabled'}</Text>
        </Pressable>
        <Text style={{ color: c.muted, fontSize: 9 }}>{`count: ${pressCount}`}</Text>
      </Box>
    </>
  );
}

function SliderDemo() {
  const c = useThemeColors();
  const [sliderVal, setSliderVal] = useState(0.5);

  return (
    <>
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SLIDER'}</Text>
      <Box style={{ alignItems: 'center', gap: 4 }}>
        <Slider
          style={{ width: 240 }}
          value={sliderVal}
          onValueChange={setSliderVal}
          activeTrackColor={c.primary}
        />
        <Text style={{ color: c.muted, fontSize: 9 }}>{`value: ${sliderVal.toFixed(2)}`}</Text>
      </Box>
    </>
  );
}

function SwitchCheckboxDemo() {
  const c = useThemeColors();
  const [switchOn, setSwitchOn] = useState(false);
  const [checkVal, setCheckVal] = useState(false);

  return (
    <>
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'SWITCH + CHECKBOX'}</Text>
      <Box style={{ flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Switch value={switchOn} onValueChange={setSwitchOn} />
          <Text style={{ color: c.text, fontSize: 10 }}>{switchOn ? 'ON' : 'OFF'}</Text>
        </Box>
        <Checkbox
          value={checkVal}
          onValueChange={setCheckVal}
          label="Check"
        />
      </Box>
    </>
  );
}

function RadioSelectDemo() {
  const c = useThemeColors();
  const [radioVal, setRadioVal] = useState('a');
  const [selectVal, setSelectVal] = useState<string | undefined>(undefined);

  return (
    <>
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'RADIO + SELECT'}</Text>
      <Box style={{ flexDirection: 'row', gap: 20, alignItems: 'center', justifyContent: 'center' }}>
        <RadioGroup value={radioVal} onValueChange={setRadioVal}>
          <Radio value="a" label="Alpha" />
          <Radio value="b" label="Beta" />
          <Radio value="c" label="Gamma" />
        </RadioGroup>
        <Select
          value={selectVal}
          onValueChange={setSelectVal}
          options={SELECT_FRUIT_OPTIONS}
          placeholder="Pick..."
        />
      </Box>
    </>
  );
}

function TextInputDemo() {
  const c = useThemeColors();
  const [inputText, setInputText] = useState('');

  return (
    <>
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'TEXT INPUT'}</Text>
      <Box style={{ alignItems: 'center', gap: 4 }}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type something..."
          style={{ width: 240 }}
          textStyle={{ fontSize: 12, color: c.text }}
        />
        <Text style={{ color: c.muted, fontSize: 9 }}>
          {inputText ? `"${inputText}"` : '(empty)'}
        </Text>
      </Box>
    </>
  );
}

function ModalDemo() {
  const c = useThemeColors();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'MODAL'}</Text>
      <Box style={{ alignItems: 'center' }}>
        <Pressable
          onPress={() => setModalOpen(true)}
          style={({ hovered }) => ({
            backgroundColor: hovered ? '#7c3aed' : '#6d28d9',
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 7, paddingBottom: 7,
            borderRadius: 6,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 11 }}>{'Open modal'}</Text>
        </Pressable>
      </Box>
      <Modal visible={modalOpen} onRequestClose={() => setModalOpen(false)}>
        <Box style={{
          width: 280,
          backgroundColor: c.surface,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: c.border,
          padding: 16,
          gap: 10,
        }}>
          <Text style={{ color: c.text, fontSize: 14, fontWeight: 'bold' }}>{'Hello'}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{'This is a modal overlay.'}</Text>
          <Box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={() => setModalOpen(false)}
              style={{ backgroundColor: c.primary, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}
            >
              <Text style={{ color: '#fff', fontSize: 11 }}>{'Close'}</Text>
            </Pressable>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

function HotkeyClipboardDemo() {
  const c = useThemeColors();
  const [lastHotkey, setLastHotkey] = useState('(none)');
  const { copy, paste, copied } = useClipboard();
  const [pastedText, setPastedText] = useState('');

  useHotkey('ctrl+z', () => setLastHotkey('Ctrl+Z'));
  useHotkey('escape', () => setLastHotkey('Escape'));

  return (
    <>
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>{'HOTKEY + CLIPBOARD'}</Text>
      <Box style={{ alignItems: 'center', gap: 4 }}>
        <Text style={{ color: c.muted, fontSize: 9 }}>{`Last hotkey: ${lastHotkey} (try Ctrl+Z or Esc)`}</Text>
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Pressable
            onPress={() => copy('Hello from Input!')}
            style={({ hovered }) => ({
              backgroundColor: hovered ? c.primary : c.surface,
              borderRadius: 4,
              paddingLeft: 10, paddingRight: 10,
              paddingTop: 4, paddingBottom: 4,
            })}
          >
            <Text style={{ color: c.text, fontSize: 10 }}>{copied ? 'Copied!' : 'Copy'}</Text>
          </Pressable>
          <Pressable
            onPress={async () => { const t = await paste(); setPastedText(t); }}
            style={({ hovered }) => ({
              backgroundColor: hovered ? c.primary : c.surface,
              borderRadius: 4,
              paddingLeft: 10, paddingRight: 10,
              paddingTop: 4, paddingBottom: 4,
            })}
          >
            <Text style={{ color: c.text, fontSize: 10 }}>{'Paste'}</Text>
          </Pressable>
          {pastedText ? <Text style={{ color: c.muted, fontSize: 9 }}>{`"${pastedText}"`}</Text> : null}
        </Box>
      </Box>
    </>
  );
}

// ── Main component ───────────────────────────────────────

export function InputStory() {
  const c = useThemeColors();
  const [playground, setPlayground] = useState(false);
  const [code, setCode] = useState(STARTER_CODE);
  const [UserComponent, setUserComponent] = useState<React.ComponentType | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const processCode = useCallback((src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  }, []);

  useEffect(() => {
    if (playground && code && !UserComponent) {
      processCode(code);
    }
  }, [playground]);

  const handleCodeChange = useCallback((src: string) => {
    setCode(src);
    processCode(src);
  }, [processCode]);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="mouse-pointer-click" style={{ width: 20, height: 20 }} tintColor={c.primary} />

        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Input'}
        </Text>

        <Box style={{
          flexDirection: 'row',
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Pressable'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{' '}</Text>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'onPress'}</Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>{'='}</Text>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'{fn}'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'>'}</Text>
        </Box>

        <Box style={{ flexGrow: 1 }} />

        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Buttons, sliders, toggles, text fields, and more.'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <Box style={{ flexGrow: 1, flexDirection: 'row' }}>
        {playground ? (
          <>
            <Box style={{ flexGrow: 1, flexBasis: 0 }}>
              <TextEditor
                initialValue={code}
                onChange={handleCodeChange}
                onBlur={handleCodeChange}
                onSubmit={handleCodeChange}
                changeDelay={3}
                syntaxHighlight
                placeholder="Write JSX here..."
                style={{ flexGrow: 1, width: '100%' }}
                textStyle={{ fontSize: 13, fontFamily: 'monospace' }}
              />
            </Box>
            <VerticalDivider />
            <Preview UserComponent={UserComponent} errors={errors} />
          </>
        ) : (
          <>
            {/* ── Left: Preview (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 20, gap: 14 }}>
                <PressableDemo />
                <SliderDemo />
                <SwitchCheckboxDemo />
                <RadioSelectDemo />
                <TextInputDemo />
                <ModalDemo />
                <HotkeyClipboardDemo />
              </Box>
            </ScrollView>

            <VerticalDivider />

            {/* ── Right: API Reference (centered) ── */}
            <ScrollView style={{ flexGrow: 1, flexBasis: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Box style={{ width: '100%', padding: 14, gap: 10 }}>

                {/* ── Overview ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </Text>
                <Text style={{ color: c.text, fontSize: 10 }}>
                  {'ReactJIT provides a full set of input primitives: Pressable for touch/click targets, Slider and Switch for continuous and boolean values, Checkbox and Radio for selection, Select for dropdown pickers, TextInput and TextEditor for text entry, and Modal for overlay dialogs. Global hotkeys and clipboard access are available via hooks.'}
                </Text>

                <HorizontalDivider />

                {/* ── Usage ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'USAGE'}
                </Text>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* ── Behavior ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </Text>
                <Box style={{ gap: 4 }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <Box key={i} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8 }} tintColor={c.muted} />
                      <Text style={{ color: c.text, fontSize: 10 }}>{note}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Components ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'COMPONENTS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {COMPONENTS.map(([name, desc, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{desc}</Text>
                    </Box>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Hooks ── */}
                <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold' }}>
                  {'HOOKS'}
                </Text>
                <Box style={{ gap: 3 }}>
                  {HOOKS.map(([name, sig, icon]) => (
                    <Box key={name} style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
                      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <Text style={{ color: c.muted, fontSize: 9 }}>{sig}</Text>
                    </Box>
                  ))}
                </Box>

              </Box>
            </ScrollView>
          </>
        )}
      </Box>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Core'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="mouse-pointer-click" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Input'}</Text>

        <Box style={{ flexGrow: 1 }} />

        <Pressable
          onPress={() => setPlayground(p => !p)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: playground ? c.primary : (state.hovered ? c.surface : c.border),
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 3,
            paddingBottom: 3,
            borderRadius: 4,
          })}
        >
          <Image
            src={playground ? 'book-open' : 'play'}
            style={{ width: 10, height: 10 }}
            tintColor={playground ? 'white' : c.text}
          />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
