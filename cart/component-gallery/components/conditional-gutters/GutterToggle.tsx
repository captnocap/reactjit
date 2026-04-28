import { Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { Icon, type IconData } from '@reactjit/runtime/icons/Icon';

export function GutterToggle({
  active,
  color,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  color: string;
  icon: IconData;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Row
        style={{
          height: 34,
          minWidth: 96,
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: 10,
          paddingRight: 10,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: active ? color : '#2d2a24',
          backgroundColor: active ? '#1f1a13' : '#12100d',
        }}
      >
        <Icon icon={icon} size={15} color={active ? color : '#746b5e'} strokeWidth={2.2} />
        <Text
          style={{
            fontSize: 10,
            lineHeight: 12,
            color: active ? '#f2e8dc' : '#9a8c78',
            fontWeight: active ? 'bold' : 'normal',
            fontFamily: 'monospace',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Row>
    </Pressable>
  );
}

