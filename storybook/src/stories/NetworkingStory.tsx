import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Text,
  Pressable,
  useFetch,
  useWebSocket,
  usePeerServer,
  useLoveRPC,
  useLoveEvent,
} from '../../../packages/core/src';
import { useCoinPrice } from '../../../packages/apis/src';
import { useRSSFeed } from '../../../packages/rss/src';
import { hmacSHA256 } from '../../../packages/webhooks/src';
import { useThemeColors } from '../../../packages/theme/src';

type NetworkingView = 'fetch' | 'websocket' | 'apis' | 'rss' | 'webhooks' | 'tor';

const NETWORKING_VIEWS: Array<{ id: NetworkingView; label: string; subtitle: string }> = [
  { id: 'fetch', label: 'Fetch', subtitle: 'HTTP and JSON response handling' },
  { id: 'websocket', label: 'WebSocket', subtitle: 'Local peer server and client loop' },
  { id: 'apis', label: 'REST APIs', subtitle: 'One-liner API hooks' },
  { id: 'rss', label: 'RSS', subtitle: 'Feed subscription and aggregation basics' },
  { id: 'webhooks', label: 'Webhooks', subtitle: 'HMAC signing and payload integrity' },
  { id: 'tor', label: 'Tor', subtitle: 'Hidden service address status' },
];

const FEED_OPTIONS = {
  'Hacker News': 'https://hnrss.org/frontpage',
  Lobsters: 'https://lobste.rs/rss',
  NASA: 'https://www.nasa.gov/news-release/feed/',
} as const;

function ShellCard({ children }: { children: React.ReactNode }) {
  const c = useThemeColors();
  return (
    <Box
      style={{
        width: '100%',
        backgroundColor: c.bgElevated,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.border,
        padding: 12,
        gap: 10,
        alignItems: 'center',
      }}
    >
      {children}
    </Box>
  );
}

function FetchPanel() {
  const c = useThemeColors();
  const [url, setUrl] = useState<string | null>(null);
  const { data, error, loading } = useFetch<any>(url);

  const run = useCallback(() => {
    setUrl(`https://httpbin.org/get?hub=networking&t=${Date.now()}`);
  }, []);

  return (
    <Box style={{ width: '100%', maxWidth: 620, gap: 8, alignItems: 'center' }}>
      <Pressable
        onPress={run}
        style={{
          backgroundColor: c.primary,
          borderRadius: 6,
          paddingLeft: 14,
          paddingRight: 14,
          paddingTop: 8,
          paddingBottom: 8,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 11 }}>{loading ? 'Fetching...' : 'GET httpbin'}</Text>
      </Pressable>

      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
        {loading && <Text style={{ color: c.warning, fontSize: 10 }}>Loading response...</Text>}
        {error && <Text style={{ color: c.error, fontSize: 10 }}>{`Error: ${error.message}`}</Text>}
        {!loading && !error && !data && <Text style={{ color: c.textDim, fontSize: 10 }}>No response yet.</Text>}
        {data && (
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>
            {JSON.stringify(data, null, 2).slice(0, 520)}
          </Text>
        )}
      </Box>
    </Box>
  );
}

function WebSocketPanel() {
  const c = useThemeColors();
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [clientUrl, setClientUrl] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const server = usePeerServer(serverPort);
  const client = useWebSocket(clientUrl);

  useEffect(() => {
    if (!server.lastMessage) return;
    const line = `server <= [${server.lastMessage.clientId}] ${server.lastMessage.data}`;
    setLogs((prev) => [...prev.slice(-7), line]);
    server.send(server.lastMessage.clientId, `echo: ${server.lastMessage.data}`);
  }, [server.lastMessage, server.send]);

  useEffect(() => {
    if (!client.lastMessage) return;
    setLogs((prev) => [...prev.slice(-7), `client <= ${client.lastMessage}`]);
  }, [client.lastMessage]);

  const sendPing = useCallback(() => {
    const msg = `ping-${Date.now()}`;
    client.send(msg);
    setLogs((prev) => [...prev.slice(-7), `client => ${msg}`]);
  }, [client.send]);

  return (
    <Box style={{ width: '100%', maxWidth: 680, gap: 10, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Pressable onPress={() => { setServerPort(8080); setLogs([]); }} style={{ backgroundColor: c.primary, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>Start Server</Text>
        </Pressable>
        <Pressable onPress={() => { setServerPort(null); setClientUrl(null); setLogs([]); }} style={{ backgroundColor: c.error, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>Stop</Text>
        </Pressable>
        <Pressable onPress={() => setClientUrl('ws://localhost:8080')} style={{ backgroundColor: c.accent, borderRadius: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>Connect Client</Text>
        </Pressable>
        <Pressable onPress={() => setClientUrl(null)} style={{ backgroundColor: c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
          <Text style={{ color: c.text, fontSize: 10 }}>Disconnect</Text>
        </Pressable>
        <Pressable onPress={sendPing} style={{ backgroundColor: client.status === 'open' ? c.success : c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}>
          <Text style={{ color: '#fff', fontSize: 10 }}>Send Ping</Text>
        </Pressable>
      </Box>

      <Box style={{ width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Text style={{ color: c.textSecondary, fontSize: 10 }}>{`Server: ${server.ready ? 'ready' : 'stopped'} (peers: ${server.peers.length})`}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 10 }}>{`Client: ${client.status}`}</Text>
      </Box>

      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, gap: 4 }}>
        {logs.length === 0 ? (
          <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>No socket traffic yet.</Text>
        ) : (
          logs.map((line, i) => (
            <Text key={`${line}-${i}`} style={{ color: c.textSecondary, fontSize: 10 }}>{line}</Text>
          ))
        )}
      </Box>
    </Box>
  );
}

function APIsPanel() {
  const c = useThemeColors();
  const { data, loading, error, refetch } = useCoinPrice('bitcoin', { include24hChange: true });

  const price = (data as any)?.bitcoin?.usd;
  const change = (data as any)?.bitcoin?.usd_24h_change;

  return (
    <Box style={{ width: '100%', maxWidth: 620, gap: 10, alignItems: 'center' }}>
      <Box style={{ backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, width: '100%', padding: 12, gap: 6, alignItems: 'center' }}>
        <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>useCoinPrice('bitcoin')</Text>
        {loading && <Text style={{ color: c.warning, fontSize: 10 }}>Loading price...</Text>}
        {error && <Text style={{ color: c.error, fontSize: 10 }}>{`Error: ${error.message}`}</Text>}
        {price != null && (
          <Box style={{ alignItems: 'center', gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
              {`$${Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            </Text>
            {change != null && (
              <Text style={{ color: change >= 0 ? c.success : c.error, fontSize: 11 }}>
                {`${change >= 0 ? '+' : ''}${Number(change).toFixed(2)}% (24h)`}
              </Text>
            )}
          </Box>
        )}
        <Pressable onPress={refetch} style={{ backgroundColor: c.bgElevated, borderRadius: 6, borderWidth: 1, borderColor: c.border, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>Refetch</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

function RSSPanel() {
  const c = useThemeColors();
  const [feedName, setFeedName] = useState<keyof typeof FEED_OPTIONS>('Hacker News');
  const { items, loading, error } = useRSSFeed(FEED_OPTIONS[feedName], { limit: 8 });

  return (
    <Box style={{ width: '100%', maxWidth: 680, gap: 10, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {(Object.keys(FEED_OPTIONS) as Array<keyof typeof FEED_OPTIONS>).map((name) => (
          <Pressable
            key={name}
            onPress={() => setFeedName(name)}
            style={{
              backgroundColor: feedName === name ? c.info : c.surface,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: c.border,
              paddingLeft: 10,
              paddingRight: 10,
              paddingTop: 5,
              paddingBottom: 5,
            }}
          >
            <Text style={{ color: feedName === name ? '#000' : c.text, fontSize: 10 }}>{name}</Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
        {loading && <Text style={{ color: c.warning, fontSize: 10, textAlign: 'center' }}>Loading feed...</Text>}
        {error && <Text style={{ color: c.error, fontSize: 10, textAlign: 'center' }}>{`Error: ${error.message}`}</Text>}
        {!loading && !error && items.length === 0 && <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>No items.</Text>}
        {items.map((item, index) => (
          <Box key={item.id || index} style={{ gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 11 }} numberOfLines={1}>{item.title}</Text>
            <Text style={{ color: c.textDim, fontSize: 9 }} numberOfLines={1}>{item.link}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function WebhooksPanel() {
  const c = useThemeColors();
  const [variant, setVariant] = useState<'push' | 'deploy'>('push');
  const secret = 'my-webhook-secret';
  const payload = variant === 'push'
    ? '{"event":"push","ref":"refs/heads/main"}'
    : '{"event":"deploy","env":"staging"}';
  const signature = useMemo(() => hmacSHA256(secret, payload), [secret, payload]);

  return (
    <Box style={{ width: '100%', maxWidth: 680, gap: 10, alignItems: 'center' }}>
      <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        <Pressable onPress={() => setVariant('push')} style={{ backgroundColor: variant === 'push' ? c.primary : c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
          <Text style={{ color: variant === 'push' ? '#fff' : c.text, fontSize: 10 }}>Push payload</Text>
        </Pressable>
        <Pressable onPress={() => setVariant('deploy')} style={{ backgroundColor: variant === 'deploy' ? c.primary : c.surface, borderRadius: 6, borderWidth: 1, borderColor: c.border, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
          <Text style={{ color: variant === 'deploy' ? '#fff' : c.text, fontSize: 10 }}>Deploy payload</Text>
        </Pressable>
      </Box>

      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 10, gap: 6 }}>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Secret</Text>
        <Text style={{ color: c.info, fontSize: 10 }}>{secret}</Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>Payload</Text>
        <Text style={{ color: c.success, fontSize: 10 }}>{payload}</Text>
        <Text style={{ color: c.textDim, fontSize: 10 }}>x-hub-signature-256</Text>
        <Text style={{ color: c.warning, fontSize: 10 }}>{`sha256=${signature}`}</Text>
      </Box>
    </Box>
  );
}

function TorPanel() {
  const c = useThemeColors();
  const getHostname = useLoveRPC<string>('tor:getHostname');
  const [hostname, setHostname] = useState<string | null>(null);
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable'>('checking');

  const refresh = useCallback(() => {
    setStatus('checking');
    getHostname()
      .then((name) => {
        if (name) {
          setHostname(name);
          setStatus('ready');
          return;
        }
        setStatus('unavailable');
      })
      .catch(() => setStatus('unavailable'));
  }, [getHostname]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useLoveEvent('tor:ready', (payload: any) => {
    if (payload && payload.hostname) {
      setHostname(payload.hostname);
      setStatus('ready');
    }
  });

  return (
    <Box style={{ width: '100%', maxWidth: 620, gap: 10, alignItems: 'center' }}>
      <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>
        Tor hidden-service networking can be bootstrapped by the runtime and exposed over RPC/events.
      </Text>

      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, padding: 12, gap: 6, alignItems: 'center' }}>
        {status === 'checking' && <Text style={{ color: c.warning, fontSize: 10 }}>Checking Tor status...</Text>}
        {status === 'unavailable' && <Text style={{ color: c.error, fontSize: 10 }}>Tor not available in this session.</Text>}
        {status === 'ready' && (
          <>
            <Text style={{ color: c.success, fontSize: 10 }}>Tor ready</Text>
            <Text style={{ color: c.accent, fontSize: 10, textAlign: 'center' }}>{hostname}</Text>
          </>
        )}
        <Pressable onPress={refresh} style={{ backgroundColor: c.bgElevated, borderRadius: 6, borderWidth: 1, borderColor: c.border, paddingLeft: 10, paddingRight: 10, paddingTop: 5, paddingBottom: 5 }}>
          <Text style={{ color: c.textSecondary, fontSize: 10 }}>Refresh</Text>
        </Pressable>
      </Box>
    </Box>
  );
}

function NetworkingViewBody({ view }: { view: NetworkingView }) {
  switch (view) {
    case 'fetch':
      return <FetchPanel />;
    case 'websocket':
      return <WebSocketPanel />;
    case 'apis':
      return <APIsPanel />;
    case 'rss':
      return <RSSPanel />;
    case 'webhooks':
      return <WebhooksPanel />;
    case 'tor':
      return <TorPanel />;
    default:
      return null;
  }
}

export function NetworkingStory() {
  const c = useThemeColors();
  const [selected, setSelected] = useState<NetworkingView>('fetch');
  const current = NETWORKING_VIEWS.find((opt) => opt.id === selected) || NETWORKING_VIEWS[0];

  return (
    <Box style={{ width: '100%', height: '100%', padding: 16, alignItems: 'center', overflow: 'scroll' }}>
      <Box style={{ width: '100%', maxWidth: 920, gap: 12, alignItems: 'center' }}>
        <Text style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>
          Networking Hub
        </Text>
        <Text style={{ color: c.textDim, fontSize: 10, textAlign: 'center' }}>
          One centered story for transport, APIs, feeds, and webhook tooling.
        </Text>

        <ShellCard>
          <Box style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
            {NETWORKING_VIEWS.map((opt) => (
              <Pressable
                key={opt.id}
                onPress={() => setSelected(opt.id)}
                style={{
                  backgroundColor: selected === opt.id ? c.primary : c.surface,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: selected === opt.id ? c.primary : c.border,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                }}
              >
                <Text style={{ color: selected === opt.id ? '#fff' : c.text, fontSize: 10 }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </Box>
        </ShellCard>

        <ShellCard>
          <Text style={{ color: c.text, fontSize: 11, textAlign: 'center' }}>{current.label}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 10, textAlign: 'center' }}>{current.subtitle}</Text>
          <NetworkingViewBody view={selected} />
        </ShellCard>
      </Box>
    </Box>
  );
}
