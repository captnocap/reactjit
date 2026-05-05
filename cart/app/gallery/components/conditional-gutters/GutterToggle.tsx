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
          borderColor: active ? color : 'theme:paperRule',
          backgroundColor: active ? 'theme:bg2' : 'theme:bg1',
        }}
      >
        <Icon icon={icon} size={15} color={active ? color : 'theme:paperInkDim'} strokeWidth={2.2} />
        <Text
          style={{
            fontSize: 10,
            lineHeight: 12,
            color: active ? 'theme:ink' : 'theme:inkDim',
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

