import { Text } from '../../../../runtime/primitives';

export function IntentTitle({ children }: { children?: any }) {
  return <Text style={{ fontSize: 18, fontWeight: 600, color: '#f8fafc' }}>{children}</Text>;
}
