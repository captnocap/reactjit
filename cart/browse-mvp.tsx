// MVP: embed a stealth `browse` Firefox session inside the cart and drive
// it from the same UI. Left pane is the controls + last-result text; right
// pane is the actual Firefox window painted via <Render renderSrc="app:…">.
//
// To run:
//   ./scripts/dev browse-mvp
//
// The cart spawns its own browse instance under Xvfb on port 7332 (so it
// doesn't collide with the user's normal `browse` running on 7331). The
// useBrowse hook talks to that instance over TCP.
//
// Suspend toggles SIGSTOP/SIGCONT on the underlying Xvfb+Firefox; the last
// frame stays painted so you can read the page without burning CPU.

import { useState } from 'react';
import { Box, Row, Col, Text, Pressable, TextInput, ScrollView, Render } from '@reactjit/runtime/primitives';
import { useBrowse } from '@reactjit/runtime/hooks/useBrowse';

const BROWSE_PORT = 7332;
const RENDER_SRC = `app:browse --port ${BROWSE_PORT} --disposable`;

export default function App() {
  const [url, setUrl] = useState('https://example.com');
  const [suspended, setSuspended] = useState(false);
  const browser = useBrowse({ port: BROWSE_PORT });

  const lastText = formatLast(browser.last);

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: '#0f0f1a' }}>
      <Row style={{ paddingTop: 8, paddingBottom: 8, paddingLeft: 12, paddingRight: 12, gap: 8, backgroundColor: '#181825', alignItems: 'center' }}>
        <Text style={{ color: '#cdd6f4', fontSize: 13, fontWeight: 'bold' }}>browse-mvp</Text>
        <Text style={{ color: '#6c7086', fontSize: 11 }}>
          {`port ${BROWSE_PORT} · ${browser.loading ? 'busy' : browser.error ? 'error' : 'idle'}`}
        </Text>
      </Row>

      <Row style={{ flexGrow: 1, gap: 4, padding: 4 }}>
        {/* Left: controls + last-result */}
        <Col style={{ flexGrow: 1, flexBasis: 0, gap: 6, backgroundColor: '#11111b', borderRadius: 4, padding: 8 }}>
          <Text style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold' }}>controls</Text>

          <TextInput
            value={url}
            onChangeText={setUrl}
            style={{
              backgroundColor: '#1e1e2e', color: '#cdd6f4',
              borderWidth: 1, borderColor: '#313244', borderRadius: 3,
              paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8,
              fontSize: 12,
            }}
          />

          <Row style={{ gap: 4, flexWrap: 'wrap' }}>
            <Btn label="navigate" onPress={() => { browser.navigate(url).catch(() => {}); }} />
            <Btn label="back" onPress={() => { browser.back().catch(() => {}); }} />
            <Btn label="forward" onPress={() => { browser.forward().catch(() => {}); }} />
            <Btn label="refresh" onPress={() => { browser.refresh().catch(() => {}); }} />
            <Btn label="extract" onPress={() => { browser.extractContent().catch(() => {}); }} />
            <Btn label="ping" onPress={() => { browser.ping(); }} />
          </Row>

          <Text style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', marginTop: 8 }}>
            {`last result${browser.error ? ' (error)' : ''}`}
          </Text>

          <ScrollView style={{ flexGrow: 1, backgroundColor: '#1e1e2e', borderRadius: 3, padding: 6 }}>
            <Text style={{ color: '#cdd6f4', fontSize: 11, fontFamily: 'monospace' }}>
              {browser.error ? browser.error.message : lastText || '(no calls yet)'}
            </Text>
          </ScrollView>
        </Col>

        {/* Right: live Firefox window */}
        <Col style={{
          flexGrow: 1, flexBasis: 0,
          borderWidth: 1, borderColor: '#2a2a4a', borderRadius: 4, overflow: 'hidden',
          backgroundColor: '#000',
        }}>
          <Row style={{ paddingTop: 4, paddingBottom: 4, paddingLeft: 8, paddingRight: 8, backgroundColor: '#181825', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: '#89b4fa', fontSize: 11, fontWeight: 'bold', flexGrow: 1 }}>
              firefox (browse stealth)
            </Text>
            <Pressable
              onPress={() => setSuspended((s) => !s)}
              style={{
                paddingTop: 2, paddingBottom: 2, paddingLeft: 8, paddingRight: 8,
                borderRadius: 3,
                backgroundColor: suspended ? '#f9e2af' : '#2a2a4a',
              }}
            >
              <Text style={{ color: suspended ? '#0f0f1a' : '#cdd6f4', fontSize: 10 }}>
                {suspended ? 'resume' : 'suspend'}
              </Text>
            </Pressable>
          </Row>
          <Render
            renderSrc={RENDER_SRC}
            renderSuspended={suspended}
            style={{ flexGrow: 1, width: '100%' }}
          />
        </Col>
      </Row>
    </Box>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10,
        borderRadius: 3,
        backgroundColor: '#313244',
      }}
    >
      <Text style={{ color: '#cdd6f4', fontSize: 11 }}>{label}</Text>
    </Pressable>
  );
}

function formatLast(last: any): string {
  if (last == null) return '';
  if (typeof last === 'string') return last;
  try {
    return JSON.stringify(last, null, 2);
  } catch {
    return String(last);
  }
}
