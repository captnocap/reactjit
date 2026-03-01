import React, { useCallback } from 'react';
import { Box, Text, Pressable, TextInput, useLocalStore, useLoveRPC } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

function CounterDemo() {
  const c = useThemeColors();
  const [count, setCount] = useLocalStore('counter', 0, { namespace: 'demo' });

  return (
    <Box style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={() => setCount(n => n - 1)}
        style={(state) => ({
          backgroundColor: state.hovered ? c.primaryHover : c.primary,
          paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
          borderRadius: 6,
        })}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'normal' }}>-</Text>
      </Pressable>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: 'normal', minWidth: 40 }}>
        {String(count)}
      </Text>
      <Pressable
        onPress={() => setCount(n => n + 1)}
        style={(state) => ({
          backgroundColor: state.hovered ? c.primaryHover : c.primary,
          paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
          borderRadius: 6,
        })}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'normal' }}>+</Text>
      </Pressable>
      <Text style={{ color: c.textDim, fontSize: 11 }}>
        Close and reopen -- this persists
      </Text>
    </Box>
  );
}

function TextMemoryDemo() {
  const c = useThemeColors();
  const [note, setNote] = useLocalStore('note', '', { namespace: 'demo' });

  return (
    <Box style={{ width: '100%', gap: 8 }}>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Type something -- it will be here when you come back"
        style={{
          backgroundColor: c.bgAlt,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 6,
          padding: 10,
        }}
        textStyle={{ color: c.text, fontSize: 13 }}
      />
      <Text style={{ color: c.textDim, fontSize: 10 }}>
        {note.length > 0 ? `${note.length} chars stored` : 'Empty'}
      </Text>
    </Box>
  );
}

function ToggleDemo() {
  const c = useThemeColors();
  const [enabled, setEnabled] = useLocalStore('feature-flag', false, { namespace: 'demo' });

  return (
    <Pressable
      onPress={() => setEnabled(v => !v)}
      style={(state) => ({
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: state.hovered ? c.surfaceHover : 'transparent',
        paddingLeft: 8, paddingRight: 8, paddingTop: 6, paddingBottom: 6,
        borderRadius: 6,
      })}
    >
      <Box style={{
        width: 16, height: 16, borderRadius: 4,
        backgroundColor: enabled ? c.success : c.bgAlt,
        borderWidth: 1,
        borderColor: enabled ? c.success : c.border,
      }} />
      <Text style={{ color: c.text, fontSize: 13 }}>
        {enabled ? 'Feature enabled' : 'Feature disabled'}
      </Text>
    </Pressable>
  );
}

function ClearStoreButton() {
  const c = useThemeColors();
  const clearStore = useLoveRPC('localstore:clear');

  const handleClear = useCallback(() => {
    clearStore({ namespace: 'demo' }).catch(() => {});
  }, [clearStore]);

  return (
    <Box style={{ width: '100%', gap: 8 }}>
      <Pressable
        onPress={handleClear}
        style={(state) => ({
          backgroundColor: state.hovered ? c.error : c.bgAlt,
          paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: c.border,
          alignSelf: 'flex-start',
        })}
      >
        <Text style={{ color: c.textSecondary, fontSize: 11 }}>
          Clear demo store
        </Text>
      </Pressable>
      <Text style={{ color: c.textDim, fontSize: 10 }}>
        Clears demo namespace only. Theme and playground have their own namespaces.
      </Text>
    </Box>
  );
}

export function LocalStoreStory() {
  const c = useThemeColors();

  return (
    <StoryPage>

      <StorySection index={1} title="Persistent Counter">
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          SQLite-backed persistence via useLocalStore. Values survive app restarts.
        </Text>
        <CounterDemo />
      </StorySection>

      <StorySection index={2} title="Text Memory">
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          Free-form text stored persistently. Type anything and close the app -- it stays.
        </Text>
        <TextMemoryDemo />
      </StorySection>

      <StorySection index={3} title="Persistent Toggle">
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          Boolean state that remembers its value across sessions.
        </Text>
        <ToggleDemo />
      </StorySection>

      <StorySection index={4} title="Manage Store">
        <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
          Clear persisted data for this demo namespace.
        </Text>
        <ClearStoreButton />
      </StorySection>

    </StoryPage>
  );
}
