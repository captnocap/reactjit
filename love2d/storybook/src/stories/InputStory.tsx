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

import React, { useState } from 'react';
import {
  Box, Text, Image, TextEditor, TextInput, CodeBlock, Pressable, ScrollView,
  Slider, Switch, Checkbox, RadioGroup, Radio, Select, Modal,
  useHotkey, useClipboard, useMount, classifiers as S} from '../../../packages/core/src';
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
  return <S.StoryDivider />;
}

function VerticalDivider() {
  const c = useThemeColors();
  return <S.VertDivider style={{ flexShrink: 0, alignSelf: 'stretch' }} />;
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
      <S.StoryTiny style={{ fontWeight: 'bold' }}>{'PRESSABLE'}</S.StoryTiny>
      <S.RowCenterG8 style={{ justifyContent: 'center' }}>
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
          <S.DimBody11>{'Disabled'}</S.DimBody11>
        </Pressable>
        <S.StoryCap>{`count: ${pressCount}`}</S.StoryCap>
      </S.RowCenterG8>
    </>
  );
}

function SliderDemo() {
  const c = useThemeColors();
  const [sliderVal, setSliderVal] = useState(0.5);

  return (
    <>
      <S.StoryTiny style={{ fontWeight: 'bold' }}>{'SLIDER'}</S.StoryTiny>
      <S.CenterG4>
        <Slider
          style={{ width: 240 }}
          value={sliderVal}
          onValueChange={setSliderVal}
          activeTrackColor={c.primary}
        />
        <S.StoryCap>{`value: ${sliderVal.toFixed(2)}`}</S.StoryCap>
      </S.CenterG4>
    </>
  );
}

function SwitchCheckboxDemo() {
  const c = useThemeColors();
  const [switchOn, setSwitchOn] = useState(false);
  const [checkVal, setCheckVal] = useState(false);

  return (
    <>
      <S.StoryTiny style={{ fontWeight: 'bold' }}>{'SWITCH + CHECKBOX'}</S.StoryTiny>
      <S.RowCenter style={{ gap: 16, justifyContent: 'center' }}>
        <S.RowCenterG6>
          <Switch value={switchOn} onValueChange={setSwitchOn} />
          <S.StoryBody>{switchOn ? 'ON' : 'OFF'}</S.StoryBody>
        </S.RowCenterG6>
        <Checkbox
          value={checkVal}
          onValueChange={setCheckVal}
          label="Check"
        />
      </S.RowCenter>
    </>
  );
}

function RadioSelectDemo() {
  const c = useThemeColors();
  const [radioVal, setRadioVal] = useState('a');
  const [selectVal, setSelectVal] = useState<string | undefined>(undefined);

  return (
    <>
      <S.StoryTiny style={{ fontWeight: 'bold' }}>{'RADIO + SELECT'}</S.StoryTiny>
      <S.RowCenter style={{ gap: 20, justifyContent: 'center' }}>
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
      </S.RowCenter>
    </>
  );
}

function TextInputDemo() {
  const c = useThemeColors();
  const [inputText, setInputText] = useState('');

  return (
    <>
      <S.StoryTiny style={{ fontWeight: 'bold' }}>{'TEXT INPUT'}</S.StoryTiny>
      <S.CenterG4>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type something..."
          style={{ width: 240 }}
          textStyle={{ fontSize: 12, color: c.text }}
        />
        <S.StoryCap>
          {inputText ? `"${inputText}"` : '(empty)'}
        </S.StoryCap>
      </S.CenterG4>
    </>
  );
}

function ModalDemo() {
  const c = useThemeColors();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <S.StoryTiny style={{ fontWeight: 'bold' }}>{'MODAL'}</S.StoryTiny>
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
        <S.Bordered style={{ width: 280, backgroundColor: c.surface, borderRadius: 10, padding: 16, gap: 10 }}>
          <S.BoldText style={{ fontSize: 14 }}>{'Hello'}</S.BoldText>
          <S.DimBody11>{'This is a modal overlay.'}</S.DimBody11>
          <Box style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <Pressable
              onPress={() => setModalOpen(false)}
              style={{ backgroundColor: c.primary, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}
            >
              <Text style={{ color: '#fff', fontSize: 11 }}>{'Close'}</Text>
            </Pressable>
          </Box>
        </S.Bordered>
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
      <S.StoryTiny style={{ fontWeight: 'bold' }}>{'HOTKEY + CLIPBOARD'}</S.StoryTiny>
      <S.CenterG4>
        <S.StoryCap>{`Last hotkey: ${lastHotkey} (try Ctrl+Z or Esc)`}</S.StoryCap>
        <S.RowCenterG8>
          <Pressable
            onPress={() => copy('Hello from Input!')}
            style={({ hovered }) => ({
              backgroundColor: hovered ? c.primary : c.surface,
              borderRadius: 4,
              paddingLeft: 10, paddingRight: 10,
              paddingTop: 4, paddingBottom: 4,
            })}
          >
            <S.StoryBody>{copied ? 'Copied!' : 'Copy'}</S.StoryBody>
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
            <S.StoryBody>{'Paste'}</S.StoryBody>
          </Pressable>
          {pastedText ? <S.StoryCap>{`"${pastedText}"`}</S.StoryCap> : null}
        </S.RowCenterG8>
      </S.CenterG4>
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

  const processCode = (src: string) => {
    const result = transformJSX(src);
    if (result.errors.length > 0) {
      setErrors(result.errors.map(e => `Line ${e.line}:${e.col}: ${e.message}`));
      return;
    }
    const evalResult = evalComponent(result.code);
    if (evalResult.error) { setErrors([evalResult.error]); return; }
    setErrors([]);
    setUserComponent(() => evalResult.component);
  };

  useMount(() => {
    if (code) processCode(code);
  });

  const handleCodeChange = (src: string) => {
    setCode(src);
    processCode(src);
  };

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.PrimaryIcon20 src="mouse-pointer-click" />

        <S.StoryTitle>
          {'Input'}
        </S.StoryTitle>

        <S.StoryBtnSm style={{ flexDirection: 'row', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'<'}</Text>
          <Text style={{ color: SYN.component, fontSize: 10 }}>{'Pressable'}</Text>
          <S.StoryMuted>{' '}</S.StoryMuted>
          <Text style={{ color: SYN.prop, fontSize: 10 }}>{'onPress'}</Text>
          <S.StoryMuted>{'='}</S.StoryMuted>
          <Text style={{ color: SYN.value, fontSize: 10 }}>{'{fn}'}</Text>
          <Text style={{ color: SYN.tag, fontSize: 10 }}>{'>'}</Text>
        </S.StoryBtnSm>

        <Box style={{ flexGrow: 1 }} />

        <S.StoryMuted>
          {'I like to be handled'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <S.RowGrow>
        {playground ? (
          <>
            <S.Half>
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
            </S.Half>
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
              <S.StackG10W100 style={{ padding: 14 }}>

                {/* ── Overview ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'OVERVIEW'}
                </S.StoryTiny>
                <S.StoryBody>
                  {'ReactJIT provides a full set of input primitives: Pressable for touch/click targets, Slider and Switch for continuous and boolean values, Checkbox and Radio for selection, Select for dropdown pickers, TextInput and TextEditor for text entry, and Modal for overlay dialogs. Global hotkeys and clipboard access are available via hooks.'}
                </S.StoryBody>

                <HorizontalDivider />

                {/* ── Usage ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'USAGE'}
                </S.StoryTiny>
                <CodeBlock language="tsx" fontSize={9} code={USAGE_CODE} />

                <HorizontalDivider />

                {/* ── Behavior ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'BEHAVIOR'}
                </S.StoryTiny>
                <Box style={{ gap: 4, width: '100%' }}>
                  {BEHAVIOR_NOTES.map((note, i) => (
                    <S.RowG6 key={i} style={{ alignItems: 'flex-start', width: '100%' }}>
                      <Image src="chevron-right" style={{ width: 8, height: 8, flexShrink: 0, marginTop: 2 }} tintColor={c.muted} />
                      <S.StoryBody style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}>{note}</S.StoryBody>
                    </S.RowG6>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Components ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'COMPONENTS'}
                </S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {COMPONENTS.map(([name, desc, icon]) => (
                    <S.RowCenterG5 key={name}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.prop} />
                      <Text style={{ color: SYN.prop, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <S.StoryCap>{desc}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

                <HorizontalDivider />

                {/* ── Hooks ── */}
                <S.StoryTiny style={{ fontWeight: 'bold' }}>
                  {'HOOKS'}
                </S.StoryTiny>
                <Box style={{ gap: 3 }}>
                  {HOOKS.map(([name, sig, icon]) => (
                    <S.RowCenterG5 key={name}>
                      <S.StorySectionIcon src={icon} tintColor={SYN.tag} />
                      <Text style={{ color: SYN.tag, fontSize: 9, fontWeight: 'bold' }}>{name}</Text>
                      <S.StoryCap>{sig}</S.StoryCap>
                    </S.RowCenterG5>
                  ))}
                </Box>

              </S.StackG10W100>
            </ScrollView>
          </>
        )}
      </S.RowGrow>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Core'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="mouse-pointer-click" />
        <S.StoryBreadcrumbActive>{'Input'}</S.StoryBreadcrumbActive>

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
          <S.StorySectionIcon src={playground ? 'book-open' : 'play'} tintColor={playground ? 'white' : c.text} />
          <Text style={{
            color: playground ? 'white' : c.text,
            fontSize: 9,
            fontWeight: 'bold',
          }}>
            {playground ? 'Exit Playground' : 'Playground'}
          </Text>
        </Pressable>

        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
