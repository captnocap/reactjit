import { Box, Pressable, Row, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Glyph, Pill } from '../shared';

interface DiffToolbarProps {
  totalAdditions: number;
  totalDeletions: number;
  inlineView: boolean;
  onToggleInline: () => void;
  wordDiffEnabled: boolean;
  onToggleWordDiff: () => void;
  virtualizeThreshold: number;
  onCycleThreshold: () => void;
  onClose: () => void;
}

export function DiffToolbar(props: DiffToolbarProps) {
  return (
    <Row
      style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderBottomWidth: 1,
        borderColor: COLORS.borderSoft,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Glyph icon="git" tone={COLORS.blue} backgroundColor="transparent" tiny={true} />
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          Checkpoint Diff
        </Text>
        {(props.totalAdditions > 0 || props.totalDeletions > 0) && (
          <Row style={{ gap: 6 }}>
            {props.totalAdditions > 0 && (
              <Pill label={'+' + props.totalAdditions} color={COLORS.green} tiny={true} />
            )}
            {props.totalDeletions > 0 && (
              <Pill label={'-' + props.totalDeletions} color={COLORS.red} tiny={true} />
            )}
          </Row>
        )}
      </Row>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <ToggleButton active={props.inlineView} label="Inline" onPress={props.onToggleInline} />
        <ToggleButton active={props.wordDiffEnabled} label="Words" onPress={props.onToggleWordDiff} />
        <Pressable onPress={props.onCycleThreshold}>
          <Box
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 4,
              paddingBottom: 4,
              borderRadius: TOKENS.radiusSm,
              borderWidth: 1,
              borderColor: COLORS.border,
              backgroundColor: COLORS.panelRaised,
            }}
          >
            <Text fontSize={9} color={COLORS.textDim}>
              V:{props.virtualizeThreshold}
            </Text>
          </Box>
        </Pressable>
        <Pressable onPress={props.onClose}>
          <Text fontSize={12} color={COLORS.textDim}>X</Text>
        </Pressable>
      </Row>
    </Row>
  );
}

function ToggleButton(props: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress}>
      <Box
        style={{
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          borderRadius: TOKENS.radiusSm,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: props.active ? COLORS.panelHover : 'transparent',
        }}
      >
        <Text fontSize={9} color={props.active ? COLORS.blue : COLORS.textDim}>
          {props.label}
        </Text>
      </Box>
    </Pressable>
  );
}
