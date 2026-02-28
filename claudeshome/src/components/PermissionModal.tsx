import React from 'react';
import { Box, Text, Pressable, Modal } from '@reactjit/core';
import { C } from '../theme';
import type { PermissionInfo } from '../hooks/useClaude';

interface Props {
  perm: PermissionInfo | null;
  onRespond: (choice: number) => void;
}

export function PermissionModal({ perm, onRespond }: Props) {
  return (
    <Modal visible={!!perm} backdropDismiss={false}>
      <Box style={{
        backgroundColor: C.surface,
        borderRadius: 12,
        padding: 24,
        width: 420,
        gap: 16,
      }}>
        <Box style={{
          backgroundColor: C.warning,
          height: 4,
          borderRadius: 2,
          width: '100%',
        }} />

        <Text style={{ color: C.text, fontSize: 16, fontWeight: 'bold' }}>
          {`${perm?.action || 'Tool'}: ${perm?.target || ''}`}
        </Text>

        {perm?.question ? (
          <Text style={{ color: C.textDim, fontSize: 13 }}>
            {perm.question}
          </Text>
        ) : null}

        <Box style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable
            onPress={() => onRespond(1)}
            style={{
              backgroundColor: C.approve,
              borderRadius: 8,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 20,
              paddingRight: 20,
              flexGrow: 1,
            }}
          >
            <Text style={{ color: C.bg, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
              {`Approve (y)`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onRespond(2)}
            style={{
              backgroundColor: C.allowAll,
              borderRadius: 8,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 20,
              paddingRight: 20,
              flexGrow: 1,
            }}
          >
            <Text style={{ color: C.bg, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
              {`Allow All (a)`}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onRespond(3)}
            style={{
              backgroundColor: C.deny,
              borderRadius: 8,
              paddingTop: 10,
              paddingBottom: 10,
              paddingLeft: 20,
              paddingRight: 20,
              flexGrow: 1,
            }}
          >
            <Text style={{ color: C.bg, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
              {`Deny (n)`}
            </Text>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
}
