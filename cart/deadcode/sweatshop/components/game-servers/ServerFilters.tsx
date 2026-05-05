import { Box, Col, Row, Text, TextInput } from '@reactjit/runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { HoverPressable } from '../shared';
import type { ServerFiltersState } from './hooks/useServerList';

function TogglePill(props: { label: string; active: boolean; onPress: () => void; tone?: string }) {
  const tone = props.tone || COLORS.blue;
  return (
    <HoverPressable onPress={props.onPress} style={{
      paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5,
      borderRadius: TOKENS.radiusMd, borderWidth: 1,
      borderColor: props.active ? tone : COLORS.border,
      backgroundColor: props.active ? COLORS.panelHover : COLORS.panelAlt,
    }}>
      <Text fontSize={10} color={props.active ? tone : COLORS.textDim} style={{ fontWeight: 'bold' }}>{props.label}</Text>
    </HoverPressable>
  );
}

function TextField(props: { value: string; onChangeText: (value: string) => void; placeholder: string; width?: number | string }) {
  return (
    <TextInput
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      style={{
        height: 32,
        width: props.width || '100%',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: TOKENS.radiusSm,
        paddingLeft: 10,
        paddingRight: 10,
        backgroundColor: COLORS.panelBg,
      }}
    />
  );
}

export function ServerFilters(props: {
  value: ServerFiltersState;
  onChange: (next: ServerFiltersState) => void;
}) {
  const set = (patch: Partial<ServerFiltersState>) => props.onChange({ ...props.value, ...patch });
  return (
    <Col style={{ gap: 10 }}>
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Text fontSize={10} color={COLORS.textDim} style={{ letterSpacing: 1.1, fontWeight: 'bold' }}>FILTERS</Text>
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <TogglePill label="Any region" active={props.value.region === 'any'} onPress={() => set({ region: 'any' })} />
        <TogglePill label="NA" active={props.value.region === 'na'} onPress={() => set({ region: 'na' })} />
        <TogglePill label="EU" active={props.value.region === 'eu'} onPress={() => set({ region: 'eu' })} />
        <TogglePill label="AS" active={props.value.region === 'as'} onPress={() => set({ region: 'as' })} />
        <TogglePill label="OC" active={props.value.region === 'oc'} onPress={() => set({ region: 'oc' })} />
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <TogglePill label="Any players" active={props.value.playerRange === 'any'} onPress={() => set({ playerRange: 'any' })} />
        <TogglePill label="0-8" active={props.value.playerRange === '0-8'} onPress={() => set({ playerRange: '0-8' })} />
        <TogglePill label="8-16" active={props.value.playerRange === '8-16'} onPress={() => set({ playerRange: '8-16' })} />
        <TogglePill label="16-32" active={props.value.playerRange === '16-32'} onPress={() => set({ playerRange: '16-32' })} />
        <TogglePill label="32+" active={props.value.playerRange === '32+'} onPress={() => set({ playerRange: '32+' })} />
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <TogglePill label="Any security" active={props.value.secure === 'any'} onPress={() => set({ secure: 'any' })} />
        <TogglePill label="Secure" active={props.value.secure === 'secure'} onPress={() => set({ secure: 'secure' })} />
        <TogglePill label="Insecure" active={props.value.secure === 'insecure'} onPress={() => set({ secure: 'insecure' })} />
        <TogglePill label="Any password" active={props.value.passwordProtected === 'any'} onPress={() => set({ passwordProtected: 'any' })} />
        <TogglePill label="Password" active={props.value.passwordProtected === 'yes'} onPress={() => set({ passwordProtected: 'yes' })} />
        <TogglePill label="Open" active={props.value.passwordProtected === 'no'} onPress={() => set({ passwordProtected: 'no' })} />
      </Row>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Box style={{ flexGrow: 1, flexBasis: 180 }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ marginBottom: 4 }}>Map</Text>
          <TextField value={props.value.map} onChangeText={(map) => set({ map })} placeholder="de_dust2, badlands, overworld…" />
        </Box>
        <Box style={{ flexGrow: 1, flexBasis: 180 }}>
          <Text fontSize={9} color={COLORS.textDim} style={{ marginBottom: 4 }}>Mode</Text>
          <TextField value={props.value.mode} onChangeText={(mode) => set({ mode })} placeholder="casual, arena, vanilla…" />
        </Box>
      </Row>
      <Box style={{ flexGrow: 1 }}>
        <Text fontSize={9} color={COLORS.textDim} style={{ marginBottom: 4 }}>Tag search</Text>
        <TextField value={props.value.tags} onChangeText={(tags) => set({ tags })} placeholder="community, surf, modded…" />
      </Box>
    </Col>
  );
}
