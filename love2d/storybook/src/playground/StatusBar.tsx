/**
 * StatusBar — Bottom bar showing lint status and error messages.
 */

import React from 'react';
import { Box, Text, Pressable, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import type { LintMessage } from './lib/linter';

interface StatusBarProps { messages: LintMessage[]; onJumpToLine?: (line: number) => void; }

export function StatusBar({ messages, onJumpToLine }: StatusBarProps) {
  const c = useThemeColors();
  const ec = messages.filter(m => m.severity === 'error').length;
  const wc = messages.filter(m => m.severity === 'warning').length;

  return (
    <Box style={{ backgroundColor: c.bgAlt, borderTopWidth: 1, borderColor: c.border, minHeight: 28 }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, gap: 12 }}>
        {!messages.length ? (
          <Text style={{ color: c.success, fontSize: 11 }}>0 errors, 0 warnings</Text>
        ) : (
          <>
            {ec > 0 && <Text style={{ color: c.error, fontSize: 11 }}>{`${ec} error${ec !== 1 ? 's' : ''}`}</Text>}
            {wc > 0 && <Text style={{ color: c.warning, fontSize: 11 }}>{`${wc} warning${wc !== 1 ? 's' : ''}`}</Text>}
          </>
        )}
      </Box>
      {messages.length > 0 && (
        <Box style={{ paddingBottom: 4 }}>
          {messages.slice(0, 5).map((msg, i) => (
            <Pressable key={i} onPress={() => onJumpToLine?.(msg.line)} style={{ flexDirection: 'row', paddingLeft: 12, paddingRight: 12, paddingTop: 2, paddingBottom: 2, gap: 8 }}>
              <Text style={{ color: msg.severity === 'error' ? c.error : c.warning, fontSize: 10, width: 40 }}>{`L${msg.line}`}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 10 }}>{msg.message}</Text>
            </Pressable>
          ))}
          {messages.length > 5 && (
            <Box style={{ paddingLeft: 12, paddingTop: 2 }}>
              <S.StoryMuted>{`+${messages.length - 5} more`}</S.StoryMuted>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
