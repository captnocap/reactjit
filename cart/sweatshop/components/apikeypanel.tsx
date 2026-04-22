// ── API Key Panel ────────────────────────────────────────────────────────────
// Settings panel for managing provider API keys with obfuscated storage.

const React: any = require('react');
const { useState } = React;

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Pill } from './shared';
import { listApiKeys, setApiKey, deleteApiKey, getApiKey, hasApiKey, validateApiKey } from '../api-keys';
import { getAllProviders } from '../providers';

export function ApiKeyPanel(props: { onChange?: () => void }) {
  const [keys, setKeys] = useState(listApiKeys());
  const [selectedProvider, setSelectedProvider] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [showInput, setShowInput] = useState(false);

  const providers = getAllProviders();

  function refresh() {
    setKeys(listApiKeys());
    props.onChange?.();
  }

  function doSave() {
    setError('');
    if (!selectedProvider || !keyInput.trim()) return;
    const v = validateApiKey(selectedProvider, keyInput.trim());
    if (!v.valid) {
      setError(v.error || 'Invalid key');
      return;
    }
    setApiKey(selectedProvider, keyInput.trim(), nickname.trim() || selectedProvider);
    setKeyInput('');
    setNickname('');
    setShowInput(false);
    setSelectedProvider('');
    refresh();
  }

  function doDelete(provider: string) {
    deleteApiKey(provider);
    refresh();
  }

  return (
    <Col style={{ gap: 14 }}>
      <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>API Keys</Text>
        <Text fontSize={10} color={COLORS.textDim}>Provider API keys are obfuscated at rest. They are never sent to any server other than the provider's API.</Text>

        <Pressable onPress={() => { setShowInput(!showInput); setError(''); }}>
          <Pill label={showInput ? 'Cancel' : '+ Add Key'} color={COLORS.blue} tiny={true} />
        </Pressable>

        {showInput && (
          <Col style={{ gap: 8, padding: 10, borderRadius: 10, backgroundColor: COLORS.panelBg }}>
            <Text fontSize={10} color={COLORS.textDim}>Provider</Text>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {providers.map(p => (
                <Pressable
                  key={p.type}
                  onPress={() => setSelectedProvider(p.type)}
                  style={{
                    padding: 6, borderRadius: 6,
                    borderWidth: 1,
                    borderColor: selectedProvider === p.type ? COLORS.blue : COLORS.border,
                    backgroundColor: selectedProvider === p.type ? COLORS.blueDeep : COLORS.panelRaised,
                  }}
                >
                  <Text fontSize={10} color={selectedProvider === p.type ? COLORS.blue : COLORS.text}>{p.type}</Text>
                </Pressable>
              ))}
            </Row>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder="Nickname (optional)"
              style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
            />
            <TextInput
              value={keyInput}
              onChangeText={setKeyInput}
              placeholder="API key"
              style={{ height: 32, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingLeft: 8, fontSize: 11, color: COLORS.text }}
            />
            {error ? <Text fontSize={10} color={COLORS.red}>{error}</Text> : null}
            <Pressable onPress={doSave} style={{ padding: 8, borderRadius: 8, backgroundColor: COLORS.blueDeep }}>
              <Text fontSize={11} color={COLORS.blue} style={{ fontWeight: 'bold' }}>Save Key</Text>
            </Pressable>
          </Col>
        )}

        <Col style={{ gap: 6 }}>
          {keys.length === 0 ? (
            <Text fontSize={10} color={COLORS.textDim}>No API keys stored.</Text>
          ) : (
            keys.map(k => (
              <Row key={k.provider} style={{ alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, backgroundColor: COLORS.panelBg }}>
                <Pill label={k.provider} color={COLORS.blue} tiny={true} />
                <Col style={{ gap: 1, flexGrow: 1, flexBasis: 0 }}>
                  <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{k.nickname}</Text>
                  <Text fontSize={9} color={COLORS.textDim}>Added {new Date(k.createdAt).toLocaleDateString()}</Text>
                </Col>
                <Pressable onPress={() => doDelete(k.provider)}>
                  <Text fontSize={10} color={COLORS.red}>Delete</Text>
                </Pressable>
              </Row>
            ))
          )}
        </Col>
      </Box>
    </Col>
  );
}
