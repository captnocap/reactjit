// Themed parallax-dots background — colors swap automatically when the
// active theme palette changes. See runtime/background.tsx for the shader
// + token resolution. Foreground card overlays prove children layer on top.

import { Box, Col, Text, Pressable } from '@reactjit/runtime/primitives';
import { Background } from '@reactjit/runtime/background';

export default function ParallaxDots() {
  return (
    <Background type="dots">
      <Col style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <Box
          style={{
            backgroundColor: '#1a1511e6',
            borderColor: '#8a4a20',
            borderWidth: 1,
            borderRadius: 14,
            paddingLeft: 28, paddingRight: 28,
            paddingTop: 22,  paddingBottom: 22,
            gap: 10,
          }}
        >
          <Text fontSize={28} color="#f2e8dc" style={{ letterSpacing: 1.2 }}>
            FOREGROUND OK
          </Text>
          <Text fontSize={13} color="#b8a890">
            Background re-themes automatically. Try swapping the active theme.
          </Text>
        </Box>
        <Pressable
          onPress={() => console.log('[parallax_dots] button pressed')}
          style={{
            backgroundColor: '#d26a2a',
            paddingLeft: 22, paddingRight: 22,
            paddingTop: 10,  paddingBottom: 10,
            borderRadius: 8,
          }}
        >
          <Text fontSize={14} color="#0e0b09" bold>HIT ME</Text>
        </Pressable>
      </Col>
    </Background>
  );
}
