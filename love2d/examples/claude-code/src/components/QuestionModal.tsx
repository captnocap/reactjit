import React from 'react';
import { Box, Text, Pressable, Modal } from '@reactjit/core';
import { C } from '../theme';
import type { QuestionInfo } from '@reactjit/terminal';

interface Props {
  question: QuestionInfo | null;
  onRespond: (optionIndex: number) => void;
}

export function QuestionModal({ question, onRespond }: Props) {
  return (
    <Modal visible={!!question} backdropDismiss={false}>
      <Box style={{
        backgroundColor: C.surface,
        borderRadius: 12,
        padding: 24,
        width: 460,
        gap: 16,
      }}>
        <Box style={{
          backgroundColor: C.accent,
          height: 4,
          borderRadius: 2,
          width: '100%',
        }} />

        <Text style={{ color: C.text, fontSize: 15, fontWeight: 'bold' }}>
          {question?.question || ''}
        </Text>

        <Box style={{ gap: 8 }}>
          {(question?.options || []).map((opt: string, i: number) => (
            <Pressable
              key={`opt-${i}`}
              onPress={() => onRespond(i + 1)}
              style={{
                backgroundColor: C.surfaceHover,
                borderRadius: 8,
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 16,
                paddingRight: 16,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Text style={{ color: C.text, fontSize: 14 }}>
                {`${i + 1}. ${opt}`}
              </Text>
            </Pressable>
          ))}
        </Box>
      </Box>
    </Modal>
  );
}
