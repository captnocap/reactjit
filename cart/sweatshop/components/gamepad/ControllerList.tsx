// =============================================================================
// ControllerList — live list of connected controllers (hot-plug aware)
// =============================================================================
// Polls __gamepad_list every 500ms and renders one row per controller.
// Clicking a row marks that joystick as active (parent reads activeId). If
// the host bridge is unbound, renders an empty strip with a short line
// pointing at the GamepadPanel banner.
// =============================================================================

import { Box, Col, Pressable, Row, Text } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';

const host: any = globalThis;

export interface ControllerDescriptor {
  id: number;
  name: string;
}

export interface ControllerListProps {
  activeId: number | null;
  onSelect: (id: number) => void;
  /** true when the host bridge is actually available. */
  bound: boolean;
}

export function ControllerList(props: ControllerListProps) {
  const [list, setList] = useState<ControllerDescriptor[]>([]);

  useEffect(() => {
    if (!props.bound) { setList([]); return; }
    const refresh = () => {
      try {
        const raw = host.__gamepad_list();
        const parsed: ControllerDescriptor[] =
          typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
        setList(Array.isArray(parsed) ? parsed : []);
      } catch {
        setList([]);
      }
    };
    refresh();
    const handle = setInterval(refresh, 500);
    return () => { try { clearInterval(handle); } catch {} };
  }, [props.bound]);

  return (
    <Col style={{
      gap: 6, padding: 10, borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Connected controllers</Text>
        <Text fontSize={9} color={COLORS.textDim}>{list.length} device{list.length === 1 ? '' : 's'}</Text>
      </Row>
      {!props.bound ? (
        <Text fontSize={10} color={COLORS.textDim}>
          Bridge missing — see the banner above. List will populate once __gamepad_list is available.
        </Text>
      ) : list.length === 0 ? (
        <Text fontSize={10} color={COLORS.textDim}>No controllers detected. Plug one in — the list hot-reloads every 500ms.</Text>
      ) : (
        <Col style={{ gap: 4 }}>
          {list.map((c) => {
            const active = props.activeId === c.id;
            return (
              <Pressable key={c.id} onPress={() => props.onSelect(c.id)} style={{
                padding: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1,
                borderColor: active ? COLORS.blue : COLORS.border,
                backgroundColor: active ? COLORS.panelHover : COLORS.panelAlt,
              }}>
                <Row style={{ alignItems: 'center', gap: 8 }}>
                  <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? COLORS.green : COLORS.textDim }} />
                  <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace' }}>#{c.id}</Text>
                  <Text fontSize={10} color={active ? COLORS.blue : COLORS.text}>{c.name || '(unnamed)'}</Text>
                </Row>
              </Pressable>
            );
          })}
        </Col>
      )}
    </Col>
  );
}
