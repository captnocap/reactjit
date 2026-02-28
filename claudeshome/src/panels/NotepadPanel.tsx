/**
 * NotepadPanel — persistent sticky notes from the human to Claude.
 *
 * Notes survive HMR and app restarts via useLocalStore (SQLite-backed).
 * TextEditor captures input independently — canvas focus gates PTY passthrough
 * so typing here does NOT go to Claude.
 */
import React, { useState, useCallback } from 'react';
import { Box, Text, ScrollView, Pressable, TextEditor, useLocalStore } from '@reactjit/core';
import { C } from '../theme';

interface Note {
  id: number;
  text: string;
  ts: number;
}

let _noteId = Date.now();
function nextId() { return ++_noteId; }

function fmt(ts: number): string {
  const d = new Date(ts);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mo}/${dd} ${hh}:${mm}`;
}

export function NotepadPanel() {
  const [notes, setNotes] = useLocalStore<Note[]>('notes', [], { namespace: 'notepad' });
  const [editorKey, setEditorKey] = useState(0);

  const handleSubmit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setNotes(prev => [...prev, { id: nextId(), text: trimmed, ts: Date.now() }]);
    setEditorKey(k => k + 1);
  }, [setNotes]);

  const deleteNote = useCallback((id: number) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  }, [setNotes]);

  return (
    <Box style={{ flexGrow: 1, flexDirection: 'column' }}>
      {/* Header */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
        flexShrink: 0,
      }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 10, color: C.textMuted, fontWeight: 'bold' }}>{'NOTEPAD'}</Text>
          {notes.length > 0 && (
            <Box style={{
              backgroundColor: C.accentDim + '22',
              borderRadius: 3,
              paddingLeft: 5,
              paddingRight: 5,
              paddingTop: 1,
              paddingBottom: 1,
            }}>
              <Text style={{ fontSize: 8, color: C.accentDim }}>{String(notes.length)}</Text>
            </Box>
          )}
        </Box>
        {notes.length > 0 && (
          <Pressable onPress={() => setNotes([])} style={{ paddingLeft: 8, paddingRight: 8 }}>
            <Text style={{ fontSize: 9, color: C.textMuted }}>{'clear all'}</Text>
          </Pressable>
        )}
      </Box>

      {/* Notes list */}
      <ScrollView style={{ flexGrow: 1 }}>
        {notes.length === 0 ? (
          <Box style={{ padding: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: C.textMuted }}>
              {'No notes yet. Type below and press Enter.'}
            </Text>
          </Box>
        ) : (
          <Box style={{ padding: 8, gap: 4 }}>
            {notes.map(note => (
              <Box key={note.id} style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 10,
                paddingRight: 8,
                backgroundColor: C.surface,
                borderRadius: 5,
                borderLeftWidth: 2,
                borderColor: C.accentDim,
              }}>
                <Box style={{ flexGrow: 1, gap: 3 }}>
                  <Text style={{ fontSize: 11, color: C.text }}>{note.text}</Text>
                  <Text style={{ fontSize: 8, color: C.textMuted }}>{fmt(note.ts)}</Text>
                </Box>
                <Pressable onPress={() => deleteNote(note.id)} style={{
                  paddingLeft: 6,
                  paddingRight: 6,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}>
                  <Text style={{ fontSize: 10, color: C.textMuted }}>{'×'}</Text>
                </Pressable>
              </Box>
            ))}
          </Box>
        )}
      </ScrollView>

      {/* Input */}
      <Box style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        flexShrink: 0,
        padding: 8,
        gap: 8,
        borderTopWidth: 1,
        borderColor: C.border,
      }}>
        <Text style={{ fontSize: 12, color: C.accentDim, paddingTop: 5 }}>{'✎'}</Text>
        <TextEditor
          key={editorKey}
          sessionId="notepad"
          onSubmit={handleSubmit}
          placeholder="Leave a note for Claude..."
          lineNumbers={false}
          style={{
            flexGrow: 1,
            height: 29,
            fontSize: 13,
            color: C.text,
            backgroundColor: C.surface,
            borderRadius: 5,
            borderWidth: 1,
            borderColor: C.border,
          }}
        />
      </Box>
    </Box>
  );
}
