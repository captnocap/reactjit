const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, Text, TextInput } from '../../../../runtime/primitives';
import { COLORS, TOKENS } from '../../theme';
import { Icon } from '../icons';
import { copyToClipboard } from '../agent/clipboard';
import { writeFile } from '../../host';

export function SystemActions(props: {
  markdown: string;
  savePath: string;
  onSavePathChange: (next: string) => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState('ready');

  const runCopy = () => {
    copyToClipboard(props.markdown);
    setStatus('copied markdown');
  };

  const runSave = () => {
    const path = props.savePath.trim() || './system-info.md';
    const ok = writeFile(path, props.markdown);
    setStatus(ok ? `saved ${path}` : `save failed: ${path}`);
  };

  return (
    <Col style={{ gap: 6 }}>
      <Row style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pressable onPress={props.onRefresh}>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="refresh" size={12} color={COLORS.blue} />
            <Text fontSize={10} color={COLORS.text}>refresh</Text>
          </Box>
        </Pressable>
        <Pressable onPress={runCopy}>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="copy" size={12} color={COLORS.blue} />
            <Text fontSize={10} color={COLORS.text}>copy as markdown</Text>
          </Box>
        </Pressable>
        <Pressable onPress={runSave}>
          <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.green, backgroundColor: COLORS.greenDeep, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="save" size={12} color={COLORS.green} />
            <Text fontSize={10} color={COLORS.green}>save to file</Text>
          </Box>
        </Pressable>
        <TextInput
          value={props.savePath}
          onChangeText={props.onSavePathChange}
          placeholder="./system-info.md"
          style={{ minWidth: 180, flexGrow: 1, flexBasis: 0, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusMd, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg, color: COLORS.textBright, fontSize: 10 }}
        />
      </Row>
      <Text fontSize={9} color={COLORS.textDim}>{status}</Text>
    </Col>
  );
}

export default SystemActions;
