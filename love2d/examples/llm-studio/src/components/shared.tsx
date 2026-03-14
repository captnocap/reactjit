import React, { useState } from 'react';
import { Box, Text, Pressable, TextInput, ScrollView, Modal } from '@reactjit/core';
import { C } from '../theme';

export function NavTab({ label, active, onPress, hint }: { label: string; active: boolean; onPress: () => void; hint?: string }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }) => (
        <Box style={{
          paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 6,
          backgroundColor: active ? C.surfaceActive : hovered ? C.surfaceHover : 'transparent',
          flexDirection: 'row', gap: 4, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, color: active ? C.text : C.textMuted, fontWeight: active ? 'bold' : 'normal' }}>
            {label}
          </Text>
          {hint && <Text style={{ fontSize: 8, color: C.textDim }}>{hint}</Text>}
        </Box>
      )}
    </Pressable>
  );
}

export function Btn({ label, color, bgColor, onPress }: { label: string; color: string; bgColor: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed, hovered }) => (
        <Box style={{
          paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 6,
          backgroundColor: pressed ? C.surfaceActive : hovered ? C.surfaceHover : bgColor,
        }}>
          <Text style={{ fontSize: 11, color, fontWeight: 'bold' }}>{label}</Text>
        </Box>
      )}
    </Pressable>
  );
}

export function LabeledInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (s: string) => void; placeholder: string;
}) {
  return (
    <Box style={{ gap: 4 }}>
      <Text style={{ fontSize: 11, color: C.textMuted, fontWeight: 'bold' }}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderColor={C.textDim}
        style={{ backgroundColor: C.bgInput, borderRadius: 6, padding: 8 }}
        textStyle={{ color: C.text, fontSize: 13 }}
      />
    </Box>
  );
}

export function QuickModelPicker({
  models, activeModel, onSelect, onClose,
}: {
  models: { id: string; name: string }[];
  activeModel: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = query ? models.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || m.id.toLowerCase().includes(query.toLowerCase())) : models;

  return (
    <Box style={{
      width: 460, maxHeight: 500, backgroundColor: C.bgElevated,
      borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
    }}>
      <Box style={{ padding: 12, borderBottomWidth: 1, borderColor: C.border }}>
        <Box style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
          <Text style={{ fontSize: 14, color: C.text, fontWeight: 'bold' }}>Quick Model Switch</Text>
          <Text style={{ fontSize: 9, color: C.textDim }}>Ctrl+M</Text>
        </Box>
        <TextInput
          value={query} onChangeText={setQuery}
          placeholder="Type to filter models..." placeholderColor={C.textDim}
          autoFocus
          style={{ backgroundColor: C.bgInput, borderRadius: 8, padding: 10 }}
          textStyle={{ color: C.text, fontSize: 13 }}
          onSubmit={() => { if (filtered.length > 0) onSelect(filtered[0].id); }}
        />
      </Box>
      <ScrollView style={{ maxHeight: 380 }}>
        <Box style={{ padding: 4, gap: 2 }}>
          {filtered.map(m => (
            <Pressable key={m.id} onPress={() => onSelect(m.id)}>
              {({ hovered }) => (
                <Box style={{
                  padding: 10, paddingLeft: 14, borderRadius: 6,
                  backgroundColor: m.id === activeModel ? C.surfaceActive : hovered ? C.surfaceHover : 'transparent',
                  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <Box>
                    <Text style={{
                      fontSize: 13, color: m.id === activeModel ? C.text : C.textMuted,
                      fontWeight: m.id === activeModel ? 'bold' : 'normal',
                    }}>
                      {m.name}
                    </Text>
                    <Text style={{ fontSize: 10, color: C.textDim }}>{m.id}</Text>
                  </Box>
                  {m.id === activeModel && (
                    <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4, backgroundColor: C.accent }}>
                      <Text style={{ fontSize: 9, color: '#fff', fontWeight: 'bold' }}>Active</Text>
                    </Box>
                  )}
                </Box>
              )}
            </Pressable>
          ))}
          {filtered.length === 0 && (
            <Box style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: C.textDim }}>No models match</Text>
            </Box>
          )}
        </Box>
      </ScrollView>
    </Box>
  );
}
