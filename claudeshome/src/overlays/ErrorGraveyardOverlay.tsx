/**
 * ErrorGraveyardOverlay — the hall of shame.
 *
 * Every shell crash logged, deduplicated, timestamped.
 * Learn. Don't repeat.
 */
import React from 'react';
import { Box, Text, Pressable, ScrollView, useHotkey } from '@reactjit/core';
import type { GraveyardEntry } from '../hooks/useErrorGraveyard';
import { C } from '../theme';

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

interface Props {
  visible:      boolean;
  entries:      GraveyardEntry[];
  totalCrashes: number;
  onClose:      () => void;
  onClear:      () => void;
}

export function ErrorGraveyardOverlay({ visible, entries, totalCrashes, onClose, onClear }: Props) {
  useHotkey('escape', () => { if (visible) onClose(); });

  if (!visible) return null;

  return (
    <Box style={{
      position:        'absolute',
      top:             0,
      left:            0,
      right:           0,
      bottom:          0,
      alignItems:      'center',
      justifyContent:  'center',
      backgroundColor: '#000000bb',
    }}>
      <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />

      {/* Card */}
      <Box style={{
        backgroundColor: C.surface,
        borderWidth:     1,
        borderColor:     C.deny + '88',
        borderRadius:    8,
        width:           520,
        maxHeight:       480,
        flexDirection:   'column',
      }}>
        {/* Header */}
        <Box style={{
          flexDirection:   'row',
          alignItems:      'center',
          justifyContent:  'space-between',
          padding:         16,
          borderBottomWidth: 1,
          borderColor:     C.border,
          flexShrink:      0,
        }}>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13, color: C.deny }}>{'☠'}</Text>
            <Text style={{ fontSize: 13, color: C.text, fontWeight: 'bold' }}>{'ERROR GRAVEYARD'}</Text>
            <Box style={{
              backgroundColor: C.deny + '22',
              borderRadius:    3,
              paddingLeft:     6,
              paddingRight:    6,
              paddingTop:      1,
              paddingBottom:   1,
            }}>
              <Text style={{ fontSize: 9, color: C.deny }}>
                {`${totalCrashes} total crash${totalCrashes !== 1 ? 'es' : ''}`}
              </Text>
            </Box>
          </Box>
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {entries.length > 0 && (
              <Pressable onPress={onClear}>
                <Text style={{ fontSize: 9, color: C.textMuted }}>{'clear all'}</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 11, color: C.textMuted }}>{'✕'}</Text>
            </Pressable>
          </Box>
        </Box>

        {/* Entry list */}
        {entries.length === 0 ? (
          <Box style={{ padding: 32, alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20, color: C.approve }}>{'✓'}</Text>
            <Text style={{ fontSize: 12, color: C.textDim }}>{'No crashes recorded.'}</Text>
            <Text style={{ fontSize: 10, color: C.textMuted }}>{'Keep it that way.'}</Text>
          </Box>
        ) : (
          <ScrollView style={{ flexGrow: 1 }}>
            <Box style={{ padding: 12, gap: 8 }}>
              {entries.map((entry, i) => (
                <Box key={entry.id} style={{
                  backgroundColor: i === 0 ? C.deny + '0d' : C.bg,
                  borderWidth:     1,
                  borderColor:     i === 0 ? C.deny + '44' : C.border,
                  borderRadius:    5,
                  padding:         10,
                  gap:             6,
                }}>
                  {/* Meta row */}
                  <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Box style={{
                      backgroundColor: C.deny + '22',
                      borderRadius:    3,
                      paddingLeft:     5,
                      paddingRight:    5,
                      paddingTop:      1,
                      paddingBottom:   1,
                    }}>
                      <Text style={{ fontSize: 8, color: C.deny, fontWeight: 'bold' }}>
                        {entry.count > 1 ? `×${entry.count}` : '×1'}
                      </Text>
                    </Box>
                    <Text style={{ fontSize: 8, color: C.textMuted, flexGrow: 1 }}>
                      {`first: ${timeAgo(entry.firstSeen)}`}
                      {entry.count > 1 ? `  last: ${timeAgo(entry.lastSeen)}` : ''}
                    </Text>
                  </Box>
                  {/* Message */}
                  <Text style={{ fontSize: 10, color: C.textDim, lineHeight: 16 }}>
                    {entry.message}
                  </Text>
                </Box>
              ))}
            </Box>
          </ScrollView>
        )}

        {/* Footer */}
        <Box style={{
          paddingLeft:    16,
          paddingRight:   16,
          paddingTop:     8,
          paddingBottom:  8,
          borderTopWidth: 1,
          borderColor:    C.border,
          flexShrink:     0,
        }}>
          <Text style={{ fontSize: 9, color: C.textMuted, textAlign: 'center' }}>
            {'Learn from your mistakes. Each one only needs to happen once.'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
