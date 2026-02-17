import React, { useState } from 'react';
import { Box, Text, Pressable, TextEditor, useHotkey, useClipboard } from '../../../packages/shared/src';
import type { LoveEvent } from '../../../packages/shared/src/types';

const SAMPLE_TEXT = 'Hello from useClipboard!';

export function KeyboardHooksStory() {
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
    <Box style={{ gap: 20, padding: 20 }}>

      {/* 1. useHotkey */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>useHotkey</Text>
        <Text style={{ color: '#64748b', fontSize: 11 }}>
          Press Ctrl+Z, Ctrl+Shift+S, or Escape anywhere.
        </Text>
        <Box style={{
          padding: 12,
          backgroundColor: '#1e293b',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#334155',
          gap: 6,
        }}>
          <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
            {`Last hotkey: ${lastHotkey}`}
          </Text>
          <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
            {`Total fires: ${hotkeyCount}`}
          </Text>
        </Box>
      </Box>

      {/* 2. useClipboard */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>useClipboard</Text>
        <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => copy(SAMPLE_TEXT)}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#1d4ed8' : hovered ? '#2563eb' : '#3b82f6',
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              const text = await paste();
              setPastedText(text);
            }}
            style={({ pressed, hovered }) => ({
              backgroundColor: pressed ? '#16a34a' : hovered ? '#22c55e' : '#15803d',
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 6,
              alignItems: 'center',
            })}
          >
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>Paste</Text>
          </Pressable>
        </Box>
        <Box style={{
          padding: 12,
          backgroundColor: '#1e293b',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#334155',
          gap: 6,
        }}>
          <Text style={{ color: '#64748b', fontSize: 11 }}>
            {`Will copy: "${SAMPLE_TEXT}"`}
          </Text>
          <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
            {pastedText ? `Pasted: "${pastedText}"` : 'Pasted: (nothing yet)'}
          </Text>
        </Box>
      </Box>

      {/* 3. Modifier enrichment */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Modifier Enrichment</Text>
        <Text style={{ color: '#64748b', fontSize: 11 }}>
          Press any key on the box below to see raw event data.
        </Text>
        <Box
          onKeyDown={handleKeyDown}
          style={{
            padding: 12,
            backgroundColor: '#1e293b',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: lastKeyEvent ? '#3b82f6' : '#334155',
            gap: 6,
          }}
        >
          {lastKeyEvent ? (
            <>
              <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
                {`key: "${lastKeyEvent.key}"`}
              </Text>
              <Box style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Text style={{ color: lastKeyEvent.ctrl ? '#22c55e' : '#475569', fontSize: 12 }}>
                  {`ctrl: ${lastKeyEvent.ctrl}`}
                </Text>
                <Text style={{ color: lastKeyEvent.shift ? '#22c55e' : '#475569', fontSize: 12 }}>
                  {`shift: ${lastKeyEvent.shift}`}
                </Text>
                <Text style={{ color: lastKeyEvent.alt ? '#22c55e' : '#475569', fontSize: 12 }}>
                  {`alt: ${lastKeyEvent.alt}`}
                </Text>
                <Text style={{ color: lastKeyEvent.meta ? '#22c55e' : '#475569', fontSize: 12 }}>
                  {`meta: ${lastKeyEvent.meta}`}
                </Text>
              </Box>
            </>
          ) : (
            <Text style={{ color: '#475569', fontSize: 13 }}>
              Waiting for keypress...
            </Text>
          )}
        </Box>
      </Box>

      {/* 4. TextEditor passthrough */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>TextEditor Passthrough</Text>
        <Text style={{ color: '#64748b', fontSize: 11 }}>
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
