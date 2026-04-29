
import { Box, Col, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { CommandRow } from './CommandRow';
import { type KeybindingMap, type KeybindingSpec } from './useKeybindStore';

export function CommandList(props: {
  query: string;
  onQueryChange: (value: string) => void;
  commands: KeybindingSpec[];
  bindings: KeybindingMap;
  conflictMap: Record<string, string[]>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const needle = props.query.trim().toLowerCase();
    const map: Record<string, KeybindingSpec[]> = {};
    for (const command of props.commands) {
      const chord = props.bindings[command.id] || '';
      const hay = [command.label, command.description, command.category, command.id, chord].join(' ').toLowerCase();
      if (needle && hay.indexOf(needle) < 0) continue;
      if (!map[command.category]) map[command.category] = [];
      map[command.category].push(command);
    }
    return map;
  }, [props.commands, props.query, props.bindings]);

  const categories = Object.keys(groups);

  return (
    <Col style={{ gap: 10 }}>
      <Box style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
        <Col style={{ gap: 4 }}>
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>COMMANDS</Text>
          <Text fontSize={18} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Registered shortcuts</Text>
          <Text fontSize={11} color={COLORS.textDim}>Search commands, inspect the live binding, then click a row to edit it.</Text>
        </Col>
        <TextInput
          value={props.query}
          onChangeText={props.onQueryChange}
          placeholder="Search commands"
          style={{
            height: 34,
            borderWidth: 1,
            borderColor: COLORS.border,
            borderRadius: TOKENS.radiusSm,
            paddingLeft: 10,
            paddingRight: 10,
            backgroundColor: COLORS.panelAlt,
            color: COLORS.textBright,
          }}
        />
      </Box>

      {categories.length === 0 ? (
        <Box style={{ padding: 16, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
          <Text fontSize={11} color={COLORS.textDim}>No commands match "{props.query}".</Text>
        </Box>
      ) : null}

      {categories.map((category) => (
        <Box key={category} style={{ padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
          <Text fontSize={11} color={COLORS.orange} style={{ fontWeight: 'bold', letterSpacing: 0.5 }}>{category.toUpperCase()}</Text>
          <Col style={{ gap: 8 }}>
            {groups[category].map((command) => {
              const chord = props.bindings[command.id] || '';
              const selected = props.selectedId === command.id;
              const conflict = chord && (props.conflictMap[chord] || []).length > 1;
              return (
                <CommandRow
                  key={command.id}
                  command={command}
                  chord={chord}
                  selected={selected}
                  conflict={conflict}
                  onPress={() => props.onSelect(command.id)}
                />
              );
            })}
          </Col>
        </Box>
      ))}
    </Col>
  );
}
