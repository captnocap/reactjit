// Sweatshop activity — placeholder. Demonstrates the shell's activity
// mode (state B: docked input on the side, activity in the main view)
// and the focus mechanism (state C: input takes focal mode via
// setInputFocal — activity stays visible, input slides back to a
// full-width bar).
//
// Click any worker tile to focal the input; click "release" to dock it
// back. The actual worker chat is a future iteration; for now this is
// just enough surface to exercise the shell's B↔C transitions.

import { Box, Pressable, Text } from '@reactjit/runtime/primitives';
import { useInputFocal } from '../shell';

const WORKERS = ['weft', 'warp', 'shuttle', 'loom', 'reed', 'heddle'];

export default function SweatshopPage() {
  const [focal, setFocal] = useInputFocal();
  return (
    <Box style={{
      flexGrow: 1,
      paddingLeft: 32, paddingRight: 32,
      paddingTop: 32, paddingBottom: 32,
      gap: 20,
      flexDirection: 'column',
    }}>
      <Box style={{ flexDirection: 'column', gap: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: 700, color: 'theme:ink' }}>
          Sweatshop
        </Text>
        <Text style={{ fontSize: 13, color: 'theme:inkDim' }}>
          Placeholder activity. Click a worker to focal the input
          (state C — input slides to full-width); click release to dock
          it back into the side panel (state B).
        </Text>
      </Box>

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {WORKERS.map((w) => (
          <Pressable key={w} onPress={() => setFocal(true)}>
            <Box style={{
              paddingLeft: 16, paddingRight: 16,
              paddingTop: 14, paddingBottom: 14,
              minWidth: 120, minHeight: 80,
              borderRadius: 8,
              backgroundColor: 'theme:bg2',
              borderWidth: 1, borderColor: 'theme:rule',
            }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: 'theme:ink' }}>
                {w}
              </Text>
              <Text style={{ fontSize: 11, color: 'theme:inkDim', marginTop: 8 }}>
                worker
              </Text>
            </Box>
          </Pressable>
        ))}
      </Box>

      {focal ? (
        <Pressable onPress={() => setFocal(false)}>
          <Box style={{
            paddingLeft: 14, paddingRight: 14,
            paddingTop: 6, paddingBottom: 6,
            borderRadius: 6,
            backgroundColor: 'theme:bg2',
            borderWidth: 1, borderColor: 'theme:rule',
            alignSelf: 'flex-start',
            marginTop: 8,
          }}>
            <Text style={{ fontSize: 12, color: 'theme:inkDim' }}>
              ← release input (back to docked)
            </Text>
          </Box>
        </Pressable>
      ) : null}
    </Box>
  );
}
