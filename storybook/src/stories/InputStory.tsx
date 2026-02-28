import React, { useCallback, useState } from 'react';
import {
  Box,
  Text,
  Pressable,
  Slider,
  Switch,
  Checkbox,
  RadioGroup,
  Radio,
  Select,
  ScrollView,
  Modal,
  TextEditor,
  TextInput,
  useHotkey,
  useClipboard,
} from '../../../packages/core/src';
import type { LoveEvent } from '../../../packages/core/src/types';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

const SCROLL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#f43f5e', '#a855f7', '#d946ef', '#84cc16', '#10b981',
];
const H_SCROLL_ITEM_HEIGHT = 46;
const H_SCROLL_PADDING = 8;
const H_SCROLL_GAP = 6;
const H_SCROLL_HEIGHT = H_SCROLL_ITEM_HEIGHT + H_SCROLL_PADDING * 2;

const SAMPLE_EDITOR = `function greet(name)
  print("Hello, " .. name .. "!")
end

greet("world")`;

const SAMPLE_CLIPBOARD = 'Hello from useClipboard!';

const SELECT_FRUIT_OPTIONS = [
  { label: 'Apple', value: 'apple' },
  { label: 'Banana', value: 'banana' },
  { label: 'Cherry', value: 'cherry' },
  { label: 'Dragon Fruit', value: 'dragon' },
  { label: 'Elderberry', value: 'elder' },
];

const DIFFICULTY_OPTIONS = [
  { label: 'Easy', value: 'easy' },
  { label: 'Normal', value: 'normal' },
  { label: 'Hard', value: 'hard' },
  { label: 'Nightmare', value: 'nightmare' },
];

export function InputStory() {
  const c = useThemeColors();
  const [pressCount, setPressCount] = useState(0);
  const [lastPressAction, setLastPressAction] = useState('none');

  const [sliderValueA, setSliderValueA] = useState(0.5);
  const [sliderValueB, setSliderValueB] = useState(30);
  const [switchA, setSwitchA] = useState(false);
  const [switchB, setSwitchB] = useState(true);
  const [checkboxA, setCheckboxA] = useState(false);
  const [checkboxB, setCheckboxB] = useState(true);
  const [checkboxC, setCheckboxC] = useState(false);
  const [radioFruit, setRadioFruit] = useState('apple');
  const [radioSize, setRadioSize] = useState('medium');
  const [selectFruit, setSelectFruit] = useState<string | undefined>(undefined);
  const [selectDifficulty, setSelectDifficulty] = useState('normal');

  const [editorFocused, setEditorFocused] = useState(false);
  const [editorBlurValue, setEditorBlurValue] = useState('');
  const [editorSubmitValue, setEditorSubmitValue] = useState('');

  const [lastHotkey, setLastHotkey] = useState('(none)');
  const [hotkeyCount, setHotkeyCount] = useState(0);
  const [lastKeyEvent, setLastKeyEvent] = useState<{
    key: string;
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  } | null>(null);

  const { copy, paste, copied } = useClipboard();
  const [pastedText, setPastedText] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<string | null>(null);

  useHotkey('ctrl+z', () => {
    setLastHotkey('Ctrl+Z');
    setHotkeyCount(v => v + 1);
  });
  useHotkey('ctrl+shift+s', () => {
    setLastHotkey('Ctrl+Shift+S');
    setHotkeyCount(v => v + 1);
  });
  useHotkey('escape', () => {
    setLastHotkey('Escape');
    setHotkeyCount(v => v + 1);
  });

  const handleKeyDown = useCallback((e: LoveEvent) => {
    setLastKeyEvent({
      key: e.key ?? '?',
      ctrl: e.ctrl ?? false,
      shift: e.shift ?? false,
      alt: e.alt ?? false,
      meta: e.meta ?? false,
    });
  }, []);

  const closeModal = (action?: string) => {
    setModalOpen(false);
    if (action) setModalAction(action);
  };

  return (
    <StoryPage>
        <StorySection index={1} title="Pressable">
          <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => {
                setPressCount(v => v + 1);
                setLastPressAction('press');
              }}
              style={({ pressed, hovered }) => ({
                backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : c.primary,
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: 6,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>Press me</Text>
            </Pressable>
            <Pressable
              onLongPress={() => setLastPressAction('long press')}
              onPress={() => setLastPressAction('short press')}
              style={({ pressed, hovered }) => ({
                backgroundColor: pressed ? c.accent : hovered ? c.accent : '#6d28d9',
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: 6,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>Long press</Text>
            </Pressable>
            <Pressable
              disabled
              onPress={() => {}}
              style={{
                backgroundColor: c.surface,
                paddingLeft: 18,
                paddingRight: 18,
                paddingTop: 9,
                paddingBottom: 9,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: c.textDim, fontSize: 13 }}>Disabled</Text>
            </Pressable>
          </Box>
          <Box style={{ flexDirection: 'row', gap: 16 }}>
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`Press count: ${pressCount}`}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`Last action: ${lastPressAction}`}</Text>
          </Box>
        </StorySection>

        <StorySection index={2} title="Slider + Switch">
          <Box style={{ width: '100%', maxWidth: 420, gap: 4, alignItems: 'center' }}>
            <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Slider (0-1)</Text>
            <Slider
              style={{ width: 320 }}
              value={sliderValueA}
              onValueChange={setSliderValueA}
              activeTrackColor={c.primary}
            />
            <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>{`Value: ${sliderValueA.toFixed(2)}`}</Text>
          </Box>
          <Box style={{ width: '100%', maxWidth: 420, gap: 4, alignItems: 'center' }}>
            <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Slider (0-100, step 10)</Text>
            <Slider
              style={{ width: 320 }}
              value={sliderValueB}
              minimumValue={0}
              maximumValue={100}
              step={10}
              onValueChange={setSliderValueB}
              activeTrackColor={c.success}
              thumbColor={c.success}
            />
            <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>{`Value: ${sliderValueB}`}</Text>
          </Box>
          <Box style={{ width: '100%', justifyContent: 'center', flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Switch value={switchA} onValueChange={setSwitchA} />
              <Text style={{ color: c.text, fontSize: 12 }}>{`Default: ${switchA ? 'ON' : 'OFF'}`}</Text>
            </Box>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Switch
                value={switchB}
                onValueChange={setSwitchB}
                trackColor={{ true: c.success, false: '#374151' }}
                thumbColor="#ffffff"
              />
              <Text style={{ color: c.text, fontSize: 12 }}>{`Custom: ${switchB ? 'ON' : 'OFF'}`}</Text>
            </Box>
          </Box>
        </StorySection>

        <StorySection index={3} title="ScrollView">
          <Box style={{ gap: 4 }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>Vertical (height: 120)</Text>
            <ScrollView style={{ height: 120, backgroundColor: c.surface, borderRadius: 6, padding: 8 }}>
              {SCROLL_COLORS.slice(0, 10).map((color, i) => (
                <Box
                  key={`v-${i}`}
                  style={{
                    height: 26,
                    marginBottom: 4,
                    backgroundColor: color,
                    borderRadius: 4,
                    justifyContent: 'center',
                    paddingLeft: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10 }}>{`Item ${i + 1}`}</Text>
                </Box>
              ))}
            </ScrollView>
          </Box>
          <Box style={{ gap: 4, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: c.textDim, fontSize: 10 }}>Horizontal</Text>
            <Box style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <ScrollView
                horizontal
                style={{
                  width: 620,
                  height: H_SCROLL_HEIGHT,
                  backgroundColor: c.surface,
                  borderRadius: 6,
                  padding: H_SCROLL_PADDING,
                }}
              >
                {Array.from({ length: 30 }).map((_, i) => {
                  const color = SCROLL_COLORS[i % SCROLL_COLORS.length];
                  return (
                    <Box
                      key={`h-${i}`}
                      style={{
                        width: 56,
                        height: H_SCROLL_ITEM_HEIGHT,
                        marginRight: H_SCROLL_GAP,
                        flexShrink: 0,
                        backgroundColor: color,
                        borderRadius: 4,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 9 }}>{`${i + 1}`}</Text>
                    </Box>
                  );
                })}
              </ScrollView>
            </Box>
          </Box>
        </StorySection>

        <StorySection index={4} title="TextEditor">
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            {`Click to focus. Esc blurs. Ctrl+Enter submits.`}
          </Text>
          <TextEditor
            initialValue={SAMPLE_EDITOR}
            onFocus={() => setEditorFocused(true)}
            onBlur={(text) => {
              setEditorFocused(false);
              setEditorBlurValue(text);
            }}
            onSubmit={(text) => setEditorSubmitValue(text)}
            style={{ width: '100%', height: 170, borderRadius: 6 }}
            textStyle={{ fontSize: 13 }}
          />
          <Text style={{ color: editorFocused ? c.primary : c.textDim, fontSize: 11 }}>
            {editorFocused ? 'Focused' : 'Unfocused'}
          </Text>
          {editorBlurValue !== '' && (
            <Text style={{ color: c.textSecondary, fontSize: 11 }}>
              {`Last blur: ${editorBlurValue.slice(0, 60)}...`}
            </Text>
          )}
          {editorSubmitValue !== '' && (
            <Text style={{ color: c.success, fontSize: 11 }}>
              {`Last submit: ${editorSubmitValue.slice(0, 60)}...`}
            </Text>
          )}
        </StorySection>

        <StorySection index={5} title="Keyboard hooks + clipboard">
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            Press Ctrl+Z, Ctrl+Shift+S, or Escape anywhere.
          </Text>
          <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => copy(SAMPLE_CLIPBOARD)}
              style={({ pressed, hovered }) => ({
                backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : c.primary,
                borderRadius: 6,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 8,
                paddingBottom: 8,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{copied ? 'Copied!' : 'Copy'}</Text>
            </Pressable>
            <Pressable
              onPress={async () => {
                const text = await paste();
                setPastedText(text);
              }}
              style={({ pressed, hovered }) => ({
                backgroundColor: pressed ? c.success : hovered ? c.success : '#15803d',
                borderRadius: 6,
                paddingLeft: 14,
                paddingRight: 14,
                paddingTop: 8,
                paddingBottom: 8,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Paste</Text>
            </Pressable>
          </Box>
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`Last hotkey: ${lastHotkey}`}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`Hotkey count: ${hotkeyCount}`}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>
            {pastedText ? `Pasted: "${pastedText}"` : 'Pasted: (nothing yet)'}
          </Text>
        </StorySection>

        <StorySection index={6} title="Raw key event modifiers">
          <Text style={{ color: c.textDim, fontSize: 10 }}>
            Press any key while focusing the box below.
          </Text>
          <Box
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              backgroundColor: c.surface,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: lastKeyEvent ? c.primary : c.border,
              padding: 12,
              gap: 6,
            }}
          >
            {lastKeyEvent ? (
              <>
                <Text style={{ color: c.text, fontSize: 12 }}>{`key: "${lastKeyEvent.key}"`}</Text>
                <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={{ color: lastKeyEvent.ctrl ? c.success : c.textDim, fontSize: 11 }}>{`ctrl: ${lastKeyEvent.ctrl}`}</Text>
                  <Text style={{ color: lastKeyEvent.shift ? c.success : c.textDim, fontSize: 11 }}>{`shift: ${lastKeyEvent.shift}`}</Text>
                  <Text style={{ color: lastKeyEvent.alt ? c.success : c.textDim, fontSize: 11 }}>{`alt: ${lastKeyEvent.alt}`}</Text>
                  <Text style={{ color: lastKeyEvent.meta ? c.success : c.textDim, fontSize: 11 }}>{`meta: ${lastKeyEvent.meta}`}</Text>
                </Box>
              </>
            ) : (
              <Text style={{ color: c.textDim, fontSize: 12 }}>Waiting for keypress...</Text>
            )}
          </Box>
        </StorySection>

        <StorySection index={7} title="Modal">
          <Box style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable
              onPress={() => setModalOpen(true)}
              style={({ pressed, hovered }) => ({
                backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : c.primary,
                borderRadius: 6,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 9,
                paddingBottom: 9,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>Open modal</Text>
            </Pressable>
            {modalAction && (
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{modalAction}</Text>
            )}
          </Box>

          <Modal visible={modalOpen} onRequestClose={() => closeModal('Dismissed')}>
            <Box style={{
              width: 360,
              backgroundColor: c.surface,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.border,
              padding: 16,
              gap: 10,
            }}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: 'bold' }}>Input Summary</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`Press count: ${pressCount}`}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`Slider: ${sliderValueB}`}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12 }}>{`Switch: ${switchA ? 'ON' : 'OFF'}`}</Text>
              <Box style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
                <Pressable
                  onPress={() => closeModal('Cancelled')}
                  style={{
                    backgroundColor: c.bgElevated,
                    borderRadius: 6,
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 7,
                    paddingBottom: 7,
                  }}
                >
                  <Text style={{ color: c.text, fontSize: 12 }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => closeModal('Confirmed')}
                  style={{
                    backgroundColor: c.primary,
                    borderRadius: 6,
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 7,
                    paddingBottom: 7,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Confirm</Text>
                </Pressable>
              </Box>
            </Box>
          </Modal>
        </StorySection>

        <StorySection index={8} title="Checkbox">
          <Box style={{ width: '100%', maxWidth: 460, gap: 10, alignItems: 'center' }}>
            <Box style={{ width: '100%', gap: 8, alignItems: 'center' }}>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Basic</Text>
              <Checkbox
                value={checkboxA}
                onValueChange={setCheckboxA}
                label="Accept terms"
              />
              <Checkbox
                value={checkboxB}
                onValueChange={setCheckboxB}
                label="Subscribe to newsletter"
              />
            </Box>

            <Box style={{ width: '100%', gap: 8, alignItems: 'center' }}>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Custom + disabled</Text>
              <Checkbox
                value={checkboxC}
                onValueChange={setCheckboxC}
                label="Green checkbox"
                color={c.success}
              />
              <Box style={{ flexDirection: 'row', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Checkbox value={false} disabled label="Unchecked disabled" />
                <Checkbox value={true} disabled label="Checked disabled" />
              </Box>
            </Box>

            <Text style={{ color: c.textSecondary, fontSize: 12, textAlign: 'center' }}>
              {`Values: ${checkboxA ? 'A:on' : 'A:off'} | ${checkboxB ? 'B:on' : 'B:off'} | ${checkboxC ? 'C:on' : 'C:off'}`}
            </Text>
          </Box>
        </StorySection>

        <StorySection index={9} title="Radio">
          <Box style={{ width: '100%', maxWidth: 460, gap: 10, alignItems: 'center' }}>
            <Box style={{ width: '100%', gap: 8, alignItems: 'center' }}>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Favorite fruit</Text>
              <RadioGroup value={radioFruit} onValueChange={setRadioFruit} style={{ alignItems: 'center' }}>
                <Radio value="apple" label="Apple" />
                <Radio value="banana" label="Banana" />
                <Radio value="cherry" label="Cherry" />
                <Radio value="grape" label="Grape" />
              </RadioGroup>
            </Box>

            <Box style={{ width: '100%', gap: 8, alignItems: 'center' }}>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Custom colors</Text>
              <RadioGroup value={radioSize} onValueChange={setRadioSize} style={{ alignItems: 'center' }}>
                <Radio value="small" label="Small" color={c.success} />
                <Radio value="medium" label="Medium" color={c.warning} />
                <Radio value="large" label="Large" color={c.error} />
              </RadioGroup>
            </Box>

            <Text style={{ color: c.textSecondary, fontSize: 12, textAlign: 'center' }}>
              {`Selected: fruit=${radioFruit}, size=${radioSize}`}
            </Text>
          </Box>
        </StorySection>

        <StorySection index={10} title="Select">
          <Box style={{ width: '100%', maxWidth: 460, gap: 10, alignItems: 'center' }}>
            <Box style={{ width: '100%', gap: 4, alignItems: 'center' }}>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>With placeholder</Text>
              <Select
                value={selectFruit}
                onValueChange={setSelectFruit}
                options={SELECT_FRUIT_OPTIONS}
                placeholder="Pick a fruit..."
              />
            </Box>

            <Box style={{ width: '100%', gap: 4, alignItems: 'center' }}>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Pre-selected + custom color</Text>
              <Select
                value={selectDifficulty}
                onValueChange={setSelectDifficulty}
                options={DIFFICULTY_OPTIONS}
                color={c.warning}
              />
            </Box>

            <Box style={{ width: '100%', gap: 4, alignItems: 'center' }}>
              <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>Disabled</Text>
              <Select
                value="cherry"
                options={SELECT_FRUIT_OPTIONS}
                disabled
              />
            </Box>

            <Text style={{ color: c.textSecondary, fontSize: 12, textAlign: 'center' }}>
              {`Selected: fruit=${selectFruit ?? 'none'}, difficulty=${selectDifficulty}`}
            </Text>
          </Box>
        </StorySection>
    </StoryPage>
  );
}
