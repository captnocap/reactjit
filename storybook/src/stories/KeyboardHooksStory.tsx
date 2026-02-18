import React, { useState } from 'react';
import { Box, Text, Pressable, TextEditor, useHotkey, useClipboard } from '../../../packages/shared/src';
import type { LoveEvent } from '../../../packages/shared/src/types';
import { useThemeColors } from '../../../packages/theme/src';

const SAMPLE_TEXT = 'Hello from useClipboard!';

export function KeyboardHooksStory() {
  const c = useThemeColors();
  const [lastHotkey, setLastHotkey] = useState('(none)');
  const [hotkeyCount, setHotkeyCount] = useState(0);
  const { copy, paste, copied } = useClipboard();
  const [pastedText, setPastedText] = useState('');
  const [lastKeyEvent, setLastKeyEvent] = useState<{
    key: string; ctrl: boolean; shift: boolean; alt: boolean; meta: boolean;
  } | null>(null);

  useHotkey('ctrl+z', () => {
    setLastHotkey('Ctrl+Z');
    setHotkeyCount(c => c + 1);
  });

  useHotkey('ctrl+shift+s', () => {
    setLastHotkey('Ctrl+Shift+S');
    setHotkeyCount(c => c + 1);
  });

  useHotkey('escape', () => {
    setLastHotkey('Escape');
    setHotkeyCount(c => c + 1);
  });

  const handleKeyDown = (e: LoveEvent) => {
    setLastKeyEvent({
      key: e.key ?? '?',
      ctrl: e.ctrl ?? false,
      shift: e.shift ?? false,
      alt: e.alt ?? false,
      meta: e.meta ?? false,
    });
  };

  return (
    <Box style={{ width: '100%', gap: 20, padding: 20 }}>

      {/* 1. useHotkey */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>useHotkey</Text>
        <Text style={{ color: c.textDim, fontSize: 11 }}>
          Press Ctrl+Z, Ctrl+Shift+S, or Escape anywhere.
        </Text>
        <Box style={{
          padding: 12,
          backgroundColor: c.bgElevated,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          gap: 6,
        }}>
          <Text style={{ color: c.text, fontSize: 13 }}>
            {`Last hotkey: ${lastHotkey}`}
          </Text>
          <Text style={{ color: c.text, fontSize: 13 }}>
            {`Total fires: ${hotkeyCount}`}
          </Text>
        </Box>
      </Box>

      {/* 2. useClipboard */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>useClipboard</Text>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => copy(SAMPLE_TEXT)}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? c.primaryPressed : hovered ? c.primaryHover : c.primary,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              const text = await paste();
              setPastedText(text);
            }}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? c.success : hovered ? c.success : c.success,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Paste</Text>
          </Pressable>
        </Box>
        <Box style={{
          padding: 12,
          backgroundColor: c.bgElevated,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.border,
          gap: 6,
        }}>
          <Text style={{ color: c.textDim, fontSize: 11 }}>
            {`Will copy: "${SAMPLE_TEXT}"`}
          </Text>
          <Text style={{ color: c.text, fontSize: 13 }}>
            {pastedText ? `Pasted: "${pastedText}"` : 'Pasted: (nothing yet)'}
          </Text>
        </Box>
      </Box>

      {/* 3. Modifier enrichment */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Modifier Enrichment</Text>
        <Text style={{ color: c.textDim, fontSize: 11 }}>
          Press any key on the box below to see raw event data.
        </Text>
        <Box
          onKeyDown={handleKeyDown}
          style={{
            padding: 12,
            backgroundColor: c.bgElevated,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: lastKeyEvent ? c.primary : c.border,
            gap: 6,
          }}
        >
          {lastKeyEvent ? (
            <>
              <Text style={{ color: c.text, fontSize: 13 }}>
                {`key: "${lastKeyEvent.key}"`}
              </Text>
              <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: lastKeyEvent.ctrl ? c.success : c.textDim, fontSize: 12 }}>
                  {`ctrl: ${lastKeyEvent.ctrl}`}
                </Text>
                <Text style={{ color: lastKeyEvent.shift ? c.success : c.textDim, fontSize: 12 }}>
                  {`shift: ${lastKeyEvent.shift}`}
                </Text>
                <Text style={{ color: lastKeyEvent.alt ? c.success : c.textDim, fontSize: 12 }}>
                  {`alt: ${lastKeyEvent.alt}`}
                </Text>
                <Text style={{ color: lastKeyEvent.meta ? c.success : c.textDim, fontSize: 12 }}>
                  {`meta: ${lastKeyEvent.meta}`}
                </Text>
              </Box>
            </>
          ) : (
            <Text style={{ color: c.textDim, fontSize: 13 }}>
              Waiting for keypress...
            </Text>
          )}
        </Box>
      </Box>

      {/* 4. TextEditor passthrough */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: c.textSecondary, fontSize: 11, fontWeight: 'bold' }}>TextEditor Passthrough</Text>
        <Text style={{ color: c.textDim, fontSize: 11 }}>
          Focus the editor and press Ctrl+Z — the useHotkey counter above should still fire.
        </Text>
        <TextEditor
          initialValue="Type here. Press Ctrl+Z while focused to test hotkey passthrough."
          style={{ width: '100%', height: 120, borderRadius: 6 }}
          textStyle={{ fontSize: 13 }}
        />
      </Box>
    </Box>
  );
}
