import { Box, Text } from '../../../../runtime/primitives';

/**
 * Inline keyboard chip — for showing shortcuts like Cmd+S, Ctrl+K, Esc.
 * Smaller and lighter than Badge; designed to live inline with text.
 */
export function IntentKbd({ children }: { children?: any }) {
  return (
    <Box style={{
      paddingLeft: 6,
      paddingRight: 6,
      paddingTop: 1,
      paddingBottom: 1,
      backgroundColor: '#1e293b',
      borderWidth: 1,
      borderColor: '#475569',
      borderRadius: 4,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ fontSize: 11, color: '#cbd5e1', fontFamily: 'monospace' }}>{children}</Text>
    </Box>
  );
}
