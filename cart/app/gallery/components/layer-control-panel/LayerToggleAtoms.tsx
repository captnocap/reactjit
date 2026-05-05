import { Pressable } from '@reactjit/runtime/primitives';
import { Eye, EyeOff, Lock, LockOpen } from '@reactjit/runtime/icons/icons';
import { Icon } from '@reactjit/runtime/icons/Icon';
import { CTRL } from '../controls-specimen/controlsSpecimenTheme';

export type LayerToggleProps = {
  active: boolean;
  onPress?: () => void;
};

function ToggleBox({
  active,
  onPress,
  icon,
}: LayerToggleProps & {
  icon: number[][];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        borderWidth: 1,
        borderColor: active ? CTRL.accent : CTRL.rule,
        backgroundColor: active ? CTRL.softAccent : CTRL.bg1,
      }}
    >
      <Icon icon={icon} size={13} color={active ? CTRL.accent : CTRL.inkDimmer} strokeWidth={2.1} />
    </Pressable>
  );
}

export function LayerVisibilityToggle({ active, onPress }: LayerToggleProps) {
  return <ToggleBox active={active} onPress={onPress} icon={active ? Eye : EyeOff} />;
}

export function LayerLockToggle({ active, onPress }: LayerToggleProps) {
  return <ToggleBox active={active} onPress={onPress} icon={active ? Lock : LockOpen} />;
}
