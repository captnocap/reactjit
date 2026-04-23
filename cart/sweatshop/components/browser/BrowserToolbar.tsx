import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';

function Button(props: { label: string; icon: string; disabled?: boolean; onPress: () => void }) {
  const disabled = props.disabled === true;
  return (
    <Pressable onPress={props.onPress} disabled={disabled}>
      <Box style={{
        height: 30,
        paddingLeft: 8,
        paddingRight: 8,
        borderRadius: TOKENS.radiusSm,
        borderWidth: 1,
        borderColor: disabled ? COLORS.borderSoft : COLORS.border,
        backgroundColor: disabled ? COLORS.panelAlt : COLORS.panelRaised,
        opacity: disabled ? 0.45 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}>
        <Icon name={props.icon as any} size={14} color={disabled ? COLORS.textDim : COLORS.textBright} />
        <Text fontSize={9} color={disabled ? COLORS.textDim : COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.label}</Text>
      </Box>
    </Pressable>
  );
}

export function BrowserToolbar(props: {
  url: string;
  loading: boolean;
  canBack: boolean;
  canForward: boolean;
  onUrlChange: (value: string) => void;
  onGo: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onNewTab: () => void;
}) {
  return (
    <Col style={{ gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelRaised }}>
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button label="Back" icon="chevron-left" disabled={!props.canBack} onPress={props.onBack} />
        <Button label="Forward" icon="chevron-right" disabled={!props.canForward} onPress={props.onForward} />
        <Button label="Reload" icon="refresh" disabled={props.loading} onPress={props.onReload} />
        <Button label="New tab" icon="plus" onPress={props.onNewTab} />
        <Box style={{ flexGrow: 1, flexBasis: 0, minWidth: 220, paddingLeft: 10, paddingRight: 10, height: 30, alignItems: 'center', flexDirection: 'row', borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <TextInput
            value={props.url}
            onChangeText={props.onUrlChange}
            onSubmitEditing={props.onGo}
            placeholder="Enter a URL to fetch."
            style={{ flexGrow: 1, color: COLORS.textBright, fontSize: 10, fontFamily: TOKENS.fontMono }}
          />
        </Box>
        <Pressable onPress={props.onGo}>
          <Box style={{ height: 30, paddingLeft: 12, paddingRight: 12, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.blue, backgroundColor: COLORS.blueDeep, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
            <Icon name="search" size={14} color={COLORS.blue} />
            <Text fontSize={9} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{props.loading ? 'fetching…' : 'Fetch'}</Text>
          </Box>
        </Pressable>
      </Row>
    </Col>
  );
}
