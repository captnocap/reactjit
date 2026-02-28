/**
 * MemoryPanel — persistent insight browser and editor.
 *
 * Shows saved memories, lets me add new ones and delete old ones.
 * Uses TextInput for input — confirmed safe in @reactjit/core.
 */
import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView, TextInput } from '@reactjit/core';
import { C } from '../theme';
import { useMemory } from '../hooks/useMemory';
import type { MemoryCategory } from '../hooks/useMemory';

const CATEGORIES: MemoryCategory[] = ['insight', 'pattern', 'decision', 'bug', 'user-pref'];

const CAT_COLOR: Record<MemoryCategory, string> = {
  insight:    C.accent,
  pattern:    C.approve,
  decision:   C.warning,
  bug:        C.deny,
  'user-pref': C.textMuted,
};

const CAT_ICON: Record<MemoryCategory, string> = {
  insight:    '\u2605',  // ★
  pattern:    '\u25C6',  // ◆
  decision:   '\u2714',  // ✔
  bug:        '\u2620',  // ☠
  'user-pref': '\u2764', // ❤
};

function MemoryRow({ id, category, text, onDelete }: {
  id: string;
  category: MemoryCategory;
  text: string;
  onDelete: () => void;
}) {
  const color = CAT_COLOR[category] ?? C.textDim;
  const icon  = CAT_ICON[category]  ?? '·';

  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      paddingTop: 5,
      paddingBottom: 5,
      paddingLeft: 10,
      paddingRight: 8,
      borderBottomWidth: 1,
      borderColor: C.border + '33',
    }}>
      <Text style={{ fontSize: 10, color, flexShrink: 0, paddingTop: 1 }}>{icon}</Text>
      <Text style={{ fontSize: 10, color: C.text, flexGrow: 1 }}>{text}</Text>
      <Pressable onPress={onDelete} style={{ paddingLeft: 6, paddingTop: 1 }}>
        <Text style={{ fontSize: 9, color: C.textDim }}>{'×'}</Text>
      </Pressable>
    </Box>
  );
}

export function MemoryPanel() {
  const { entries, add, remove, clear } = useMemory();
  const [draft, setDraft] = useState('');
  const [activeCategory, setActiveCategory] = useState<MemoryCategory>('insight');
  const [search, setSearch] = useState('');

  const handleSubmit = () => {
    if (draft.trim()) {
      add(draft, activeCategory);
      setDraft('');
    }
  };

  const needle = search.trim().toLowerCase();
  const isSearching = needle.length > 0;

  const visibleEntries = isSearching
    ? entries.filter(e => e.text.toLowerCase().includes(needle))
    : entries;

  const byCategory = CATEGORIES.reduce<Record<string, typeof entries>>((acc, cat) => {
    acc[cat] = visibleEntries.filter(e => e.category === cat);
    return acc;
  }, {} as any);

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'MEMORY'}</Text>
          <Text style={{ fontSize: 8, color: C.textDim }}>
            {isSearching ? `${visibleEntries.length}/${entries.length}` : `${entries.length} entries`}
          </Text>
        </Box>
        <Pressable onPress={clear} style={{
          paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
          borderWidth: 1, borderColor: C.border, borderRadius: 4,
        }}>
          <Text style={{ fontSize: 8, color: C.textMuted }}>{'clear all'}</Text>
        </Pressable>
      </Box>

      {/* Search bar */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5,
        borderBottomWidth: 1,
        borderColor: C.border + '44',
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 9, color: C.textDim }}>{'\u2315'}</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={'search memories\u2026'}
          style={{
            flexGrow: 1,
            height: 24,
            backgroundColor: isSearching ? C.accent + '11' : C.surface,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: isSearching ? C.accent + '55' : C.border + '55',
            paddingLeft: 8,
            paddingRight: 8,
          }}
        />
        {isSearching && (
          <Pressable onPress={() => setSearch('')} style={{ paddingLeft: 4 }}>
            <Text style={{ fontSize: 9, color: C.textDim }}>{'×'}</Text>
          </Pressable>
        )}
      </Box>

      {/* Category selector — hidden while searching */}
      {!isSearching && (
        <Box style={{
          flexDirection: 'row',
          gap: 4,
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 6,
          paddingBottom: 6,
          borderBottomWidth: 1,
          borderColor: C.border + '44',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat;
            const color = CAT_COLOR[cat];
            return (
              <Pressable key={cat} onPress={() => setActiveCategory(cat)} style={{
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: active ? color + '88' : C.border + '44',
                backgroundColor: active ? color + '22' : 'transparent',
              }}>
                <Text style={{ fontSize: 9, color: active ? color : C.textMuted }}>
                  {CAT_ICON[cat]}
                  {` ${cat}`}
                </Text>
              </Pressable>
            );
          })}
        </Box>
      )}

      {/* Memory list */}
      <ScrollView style={{ flexGrow: 1 }}>
        {visibleEntries.length === 0 ? (
          <Box style={{ padding: 16 }}>
            <Text style={{ fontSize: 10, color: C.textDim }}>
              {isSearching ? `No matches for "${search}"` : 'No memories yet. Add your first insight below.'}
            </Text>
          </Box>
        ) : (
          CATEGORIES.map(cat => {
            const catEntries = byCategory[cat] ?? [];
            if (catEntries.length === 0) return null;
            return (
              <Box key={cat}>
                <Box style={{
                  paddingLeft: 10, paddingTop: 6, paddingBottom: 2,
                }}>
                  <Text style={{ fontSize: 8, color: CAT_COLOR[cat], fontWeight: 'bold' }}>
                    {cat.toUpperCase()}
                  </Text>
                </Box>
                {catEntries.map(e => (
                  <MemoryRow
                    key={e.id}
                    id={e.id}
                    category={e.category}
                    text={e.text}
                    onDelete={() => remove(e.id)}
                  />
                ))}
              </Box>
            );
          })
        )}
      </ScrollView>

      {/* Input */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 6,
        paddingBottom: 6,
        borderTopWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        <Text style={{ fontSize: 10, color: CAT_COLOR[activeCategory] }}>
          {CAT_ICON[activeCategory]}
        </Text>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmit={handleSubmit}
          placeholder={`Add ${activeCategory}\u2026`}
          style={{
            flexGrow: 1,
            height: 28,
            backgroundColor: C.surface,
            borderRadius: 4,
            borderWidth: 1,
            borderColor: C.border,
            paddingLeft: 8,
            paddingRight: 8,
          }}
        />
        <Pressable onPress={handleSubmit} style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          backgroundColor: CAT_COLOR[activeCategory] + '33',
          borderRadius: 4,
          borderWidth: 1,
          borderColor: CAT_COLOR[activeCategory] + '66',
        }}>
          <Text style={{ fontSize: 9, color: CAT_COLOR[activeCategory] }}>{'+'}</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
