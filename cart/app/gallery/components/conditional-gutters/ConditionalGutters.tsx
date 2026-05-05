import { useEffect, useMemo, useState } from 'react';
import { Box, Col, Row } from '@reactjit/runtime/primitives';
import { PanelBottom, PanelLeft, PanelRight, PanelTop } from '@reactjit/runtime/icons/icons';
import { ConditionalGutter } from './ConditionalGutter';
import { CommandGutter, ConsoleGutter, EditorMock, InspectorGutter, NavigationGutter } from './GutterChrome';
import { GutterToggle } from './GutterToggle';

export type ConditionalGuttersPreset = 'app-shell' | 'writer' | 'all-edges';

type GutterState = {
  command: boolean;
  nav: boolean;
  inspector: boolean;
  console: boolean;
};

function presetState(preset: ConditionalGuttersPreset): GutterState {
  switch (preset) {
    case 'writer':
      return { command: false, nav: false, inspector: true, console: false };
    case 'all-edges':
      return { command: true, nav: true, inspector: true, console: true };
    case 'app-shell':
    default:
      return { command: true, nav: true, inspector: true, console: false };
  }
}

export function ConditionalGutters({ preset = 'app-shell' }: { preset?: ConditionalGuttersPreset }) {
  const initialState = useMemo(() => presetState(preset), [preset]);
  const [gutters, setGutters] = useState<GutterState>(initialState);

  useEffect(() => {
    setGutters(initialState);
  }, [initialState]);

  const setGutter = (key: keyof GutterState, open: boolean) => {
    setGutters((prev) => ({ ...prev, [key]: open }));
  };
  const toggleGutter = (key: keyof GutterState) => setGutter(key, !gutters[key]);

  return (
    <Col
      style={{
        width: '100%',
        maxWidth: 1040,
        gap: 14,
        padding: 16,
        backgroundColor: 'theme:bg',
      }}
    >
      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <GutterToggle active={gutters.nav} color="theme:tool" icon={PanelLeft} label="Nav" onPress={() => toggleGutter('nav')} />
        <GutterToggle active={gutters.inspector} color="theme:atch" icon={PanelRight} label="Inspector" onPress={() => toggleGutter('inspector')} />
        <GutterToggle active={gutters.console} color="theme:pin" icon={PanelBottom} label="Console" onPress={() => toggleGutter('console')} />
        <GutterToggle active={gutters.command} color="theme:warn" icon={PanelTop} label="Command" onPress={() => toggleGutter('command')} />
      </Row>

      <Box
        style={{
          width: '100%',
          height: 560,
          borderWidth: 1,
          borderColor: 'theme:paperRule',
          backgroundColor: 'theme:bg',
          overflow: 'hidden',
        }}
      >
        <Col style={{ width: '100%', height: '100%', minHeight: 0 }}>
          <ConditionalGutter edge="top" open={gutters.command} size={62} durationMs={220}>
            <CommandGutter onClose={() => setGutter('command', false)} />
          </ConditionalGutter>

          <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            <ConditionalGutter edge="left" open={gutters.nav} size={220} durationMs={260}>
              <NavigationGutter onClose={() => setGutter('nav', false)} />
            </ConditionalGutter>

            <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 0 }}>
              <EditorMock />
            </Box>

            <ConditionalGutter edge="right" open={gutters.inspector} size={250} durationMs={260}>
              <InspectorGutter onClose={() => setGutter('inspector', false)} />
            </ConditionalGutter>
          </Row>

          <ConditionalGutter edge="bottom" open={gutters.console} size={132} durationMs={230}>
            <ConsoleGutter onClose={() => setGutter('console', false)} />
          </ConditionalGutter>
        </Col>
      </Box>
    </Col>
  );
}
