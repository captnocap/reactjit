import { Box, Pressable, Row, ScrollView, Text } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { Checkpoint } from '../../checkpoint';

interface DiffTurnStripProps {
  checkpoints: Checkpoint[];
  activeCheckpointId?: string;
  onSelectCheckpoint: (id: string) => void;
}

const ALL_TURNS_ID = '__all__';

function TurnChip(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={props.onPress}>
      <Box
        style={{
          paddingLeft: 10,
          paddingRight: 10,
          paddingTop: 5,
          paddingBottom: 5,
          borderRadius: TOKENS.radiusPill,
          borderWidth: 1,
          borderColor: props.active ? COLORS.blue : COLORS.border,
          backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
        }}
      >
        <Text fontSize={10} color={props.active ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>
          {props.label}
        </Text>
      </Box>
    </Pressable>
  );
}

export function DiffTurnStrip(props: DiffTurnStripProps) {
  const viewMode = props.activeCheckpointId || ALL_TURNS_ID;
  const isAllTurns = viewMode === ALL_TURNS_ID;

  return (
    <ScrollView horizontal={true} style={{ maxHeight: 48 }}>
      <Row
        style={{
          alignItems: 'center',
          gap: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 8,
          paddingBottom: 8,
          borderBottomWidth: 1,
          borderColor: COLORS.borderSoft,
        }}
      >
        <TurnChip label="All turns" active={isAllTurns} onPress={() => props.onSelectCheckpoint(ALL_TURNS_ID)} />
        {props.checkpoints.map((cp) => (
          <TurnChip
            key={cp.id}
            label={'Turn ' + (cp.turnIndex + 1)}
            active={cp.id === props.activeCheckpointId}
            onPress={() => props.onSelectCheckpoint(cp.id)}
          />
        ))}
      </Row>
    </ScrollView>
  );
}
