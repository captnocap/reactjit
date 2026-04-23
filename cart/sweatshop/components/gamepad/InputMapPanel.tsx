// =============================================================================
// InputMapPanel — editable button → named-action bindings
// =============================================================================
// This surface works whether the host bridge is up or not: the map is just a
// persistent string table under sweatshop.gamepad.map.*. When the bridge
// lands, useGamepadEvents can key off this table to dispatch actions. Until
// then, the user can still design + tweak bindings.
//
// Each row: ButtonId label on the left, TextInput for the action name,
// clear-to-default button. Bindings persist via __store_*.
// =============================================================================

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import type { ButtonId, GamepadState } from '../../lib/gamepad/types';
import {
  DPAD_BUTTONS, FACE_BUTTONS, META_BUTTONS, SHOULDER_BUTTONS,
} from '../../lib/gamepad/types';

const host: any = globalThis;
const storeGet = typeof host.__store_get === 'function' ? host.__store_get : (_: string) => null;
const storeSet = typeof host.__store_set === 'function' ? host.__store_set : (_: string, __: string) => {};
const storeDel = typeof host.__store_del === 'function' ? host.__store_del : (_: string) => {};
const K = 'sweatshop.gamepad.map.';

const DEFAULTS: Partial<Record<ButtonId, string>> = {
  a: 'confirm', b: 'cancel', x: 'menu', y: 'action',
  start: 'pause', back: 'options', guide: 'home',
  leftshoulder: 'prev-tab', rightshoulder: 'next-tab',
  leftstick: 'stick-click-l', rightstick: 'stick-click-r',
  dpup: 'nav-up', dpdown: 'nav-down', dpleft: 'nav-left', dpright: 'nav-right',
};

function getBinding(b: ButtonId): string {
  try { return String(storeGet(K + b) ?? DEFAULTS[b] ?? ''); } catch { return DEFAULTS[b] ?? ''; }
}

const GROUPS: Array<{ title: string; items: ButtonId[] }> = [
  { title: 'Face',     items: FACE_BUTTONS },
  { title: 'D-pad',    items: DPAD_BUTTONS },
  { title: 'Shoulder', items: SHOULDER_BUTTONS },
  { title: 'Meta',     items: META_BUTTONS },
];

export interface InputMapPanelProps {
  /** Live state drives the 'last pressed' indicator per row. */
  state: GamepadState;
}

export function InputMapPanel(props: InputMapPanelProps) {
  const [version, setVersion] = useState(0);
  const drafts = useRef<Partial<Record<ButtonId, string>>>({});

  const bumpVersion = () => setVersion((n: number) => n + 1);

  const setBinding = (b: ButtonId, value: string) => {
    drafts.current[b] = value;
    if (value === DEFAULTS[b] || value === '') {
      try { storeDel(K + b); } catch {}
    } else {
      try { storeSet(K + b, value); } catch {}
    }
    bumpVersion();
  };
  const resetBinding = (b: ButtonId) => {
    try { storeDel(K + b); } catch {}
    drafts.current[b] = DEFAULTS[b] ?? '';
    bumpVersion();
  };
  const resetAll = () => {
    for (const b of Object.keys(DEFAULTS) as ButtonId[]) { try { storeDel(K + b); } catch {} }
    drafts.current = {};
    bumpVersion();
  };

  return (
    <Col style={{
      gap: 10, padding: 12, borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: COLORS.border, backgroundColor: COLORS.panelRaised,
    }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Input map</Text>
        <Text fontSize={9} color={COLORS.textDim}>SDL button → named action · persists across restarts</Text>
        <Box style={{ flexGrow: 1 }} />
        <Pressable onPress={resetAll} style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3,
          borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
        }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>reset all</Text>
        </Pressable>
      </Row>

      {GROUPS.map((g) => (
        <Col key={g.title} style={{ gap: 3 }}>
          <Text fontSize={9} color={COLORS.blue} style={{ letterSpacing: 0.6, fontWeight: 'bold' }}>{g.title.toUpperCase()}</Text>
          {g.items.map((b) => {
            const binding = drafts.current[b] ?? getBinding(b);
            const custom  = binding !== (DEFAULTS[b] ?? '');
            const live    = !!props.state.buttons[b];
            return (
              <Row key={b + '_' + version} style={{
                padding: 4, gap: 8, alignItems: 'center', flexWrap: 'wrap',
                borderRadius: TOKENS.radiusSm,
                backgroundColor: live ? COLORS.panelHover : 'transparent',
              }}>
                <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: live ? COLORS.green : COLORS.textDim }} />
                <Text fontSize={10} color={COLORS.textBright} style={{ fontFamily: 'monospace', width: 100 }}>{b}</Text>
                <TextInput
                  value={binding}
                  onChangeText={(v: string) => setBinding(b, v)}
                  placeholder={DEFAULTS[b] ?? ''}
                  style={{
                    flexBasis: 180, flexShrink: 1, flexGrow: 1, height: 22,
                    borderWidth: 1, borderColor: custom ? COLORS.orange : COLORS.border,
                    borderRadius: TOKENS.radiusSm, paddingLeft: 6,
                    backgroundColor: COLORS.panelBg, fontFamily: 'monospace',
                  }}
                />
                {custom ? (
                  <Pressable onPress={() => resetBinding(b)} style={{
                    paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2,
                    borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt,
                  }}>
                    <Text fontSize={9} color={COLORS.textDim}>default</Text>
                  </Pressable>
                ) : null}
              </Row>
            );
          })}
        </Col>
      ))}
    </Col>
  );
}
