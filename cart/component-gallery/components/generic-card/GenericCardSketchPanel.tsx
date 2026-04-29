import { Col, Text } from '@reactjit/runtime/primitives';
import {
  DEFAULT_GENERIC_CARD_SKETCH_LINES,
  GENERIC_CARD,
  genericCardSketchLineColor,
} from './genericCardShared';

export type GenericCardSketchPanelProps = {
  lines?: string[];
};

export function GenericCardSketchPanel({
  lines = DEFAULT_GENERIC_CARD_SKETCH_LINES,
}: GenericCardSketchPanelProps) {
  return (
    <Col
      style={{
        padding: 13,
        gap: 2,
        backgroundColor: GENERIC_CARD.panel,
        borderWidth: 1,
        borderColor: GENERIC_CARD.panelBorder,
        borderRadius: 4,
      }}
    >
      {lines.map((line, index) => (
        <Text
          key={`${line}-${index}`}
          style={{
            fontFamily: 'monospace',
            fontSize: 10,
            color: genericCardSketchLineColor(index, lines.length),
          }}
        >
          {line}
        </Text>
      ))}
    </Col>
  );
}
