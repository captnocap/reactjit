
import { Text } from '@reactjit/runtime/primitives';
import { COLORS } from '../../../theme';
import { Icon } from '../../icons';
import { StatusSegment } from '../StatusSegment';
import { registerSegment } from '../useStatusRegistry';

export function SettingsGearSegment(props: any) {
  if (!props.onOpenSettings) return null;
  return (
    <StatusSegment onPress={() => props.onOpenSettings('providers')} tooltip="Settings">
      <Icon name="settings" size={12} color={COLORS.textDim} />
      {!props.compactBand ? <Text fontSize={10} color={COLORS.textDim}>Settings</Text> : null}
    </StatusSegment>
  );
}

registerSegment({
  id: 'settings-gear',
  label: 'Settings',
  defaultPosition: 'right',
  defaultVisible: true,
  priority: 180,
  component: SettingsGearSegment,
});
