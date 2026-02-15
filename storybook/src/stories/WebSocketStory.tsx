import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, Pressable, useWebSocket, usePeerServer, useLoveEvent, useLoveRPC } from '../../../../packages/shared/src';

function StatusDot({ status }: { status: string }) {
  const color = status === 'open' || status === 'ready' ? '#22c55e'
    : status === 'connecting' ? '#f59e0b'
    : status === 'error' ? '#ef4444'
    : '#64748b';
  return (
    <Box style={{
      width: 10, height: 10, borderRadius: 5,
      backgroundColor: color,
    }} />
  );
}

// ---- P2P Demo: Host a server + connect a client to it ----
function P2PDemo() {
  // Tor hidden service address
  const [onionAddr, setOnionAddr] = useState<string | null>(null);
  const getHostname = useLoveRPC<string>('tor:getHostname');

  // Query on mount — defeats the race where tor:ready fires before useEffect subscribes
  useEffect(() => {
    getHostname().then((hostname) => {
      if (hostname) setOnionAddr(hostname);
    }).catch(() => {}); // Tor not ready yet, event will catch it
  }, []);

  // Backup: listen for tor:ready event (covers case where Tor is still bootstrapping at mount)
  useLoveEvent('tor:ready', (payload: any) => {
    if (payload && payload.hostname) {
      setOnionAddr(payload.hostname);
    }
  });

  // Server side
  const [serverPort, setServerPort] = useState<number | null>(null);
  const server = usePeerServer(serverPort);
  const [serverLog, setServerLog] = useState<string[]>([]);

  // Client side
  const [clientUrl, setClientUrl] = useState<string | null>(null);
  const client = useWebSocket(clientUrl);
  const [clientLog, setClientLog] = useState<string[]>([]);

  // Track incoming messages
  React.useEffect(() => {
    if (server.lastMessage) {
      const msg = `[peer ${server.lastMessage.clientId}] ${server.lastMessage.data}`;
      setServerLog(prev => [...prev.slice(-6), msg]);

      // Echo back with prefix
      server.send(server.lastMessage.clientId, `echo: ${server.lastMessage.data}`);
    }
  }, [server.lastMessage]);

  React.useEffect(() => {
    if (client.lastMessage) {
      setClientLog(prev => [...prev.slice(-6), client.lastMessage!]);
    }
  }, [client.lastMessage]);

  const startServer = useCallback(() => {
    setServerPort(8080);
    setServerLog([]);
  }, []);

  const stopServer = useCallback(() => {
    setServerPort(null);
    setServerLog([]);
  }, []);

  const connectClient = useCallback(() => {
    setClientUrl('ws://localhost:8080');
    setClientLog([]);
  }, []);

  const connectViaTor = useCallback(() => {
    if (!onionAddr) return;
    setClientUrl(`ws://${onionAddr}:8080`);
    setClientLog([]);
  }, [onionAddr]);

  const disconnectClient = useCallback(() => {
    setClientUrl(null);
    setClientLog([]);
  }, []);

  const clientSend = useCallback(() => {
    const msg = `hello @ ${Date.now()}`;
    client.send(msg);
    setClientLog(prev => [...prev.slice(-6), `> ${msg}`]);
  }, [client.send]);

  const serverBroadcast = useCallback(() => {
    const msg = `broadcast @ ${Date.now()}`;
    server.broadcast(msg);
    setServerLog(prev => [...prev.slice(-6), `> ${msg}`]);
  }, [server.broadcast]);

  return (
    <Box style={{ flexDirection: 'row', gap: 16, width: '100%' }}>
      {/* Server panel */}
      <Box style={{ flexGrow: 1, gap: 8 }}>
        <Text style={{ fontSize: 14, color: '#f1f5f9' }}>Server (Host)</Text>

        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <StatusDot status={server.ready ? 'ready' : 'closed'} />
          <Text style={{ fontSize: 12, color: '#e2e8f0' }}>
            {server.ready ? `Listening on :8080` : 'Stopped'}
          </Text>
        </Box>

        <Text style={{ fontSize: 11, color: '#94a3b8' }}>
          {`Peers: ${server.peers.length}`}
        </Text>

        <Box style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable onPress={startServer} style={{
            backgroundColor: serverPort ? '#334155' : '#3b82f6',
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Start</Text>
          </Pressable>

          <Pressable onPress={stopServer} style={{
            backgroundColor: serverPort ? '#ef4444' : '#334155',
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Stop</Text>
          </Pressable>

          <Pressable onPress={serverBroadcast} style={{
            backgroundColor: server.ready ? '#8b5cf6' : '#334155',
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Broadcast</Text>
          </Pressable>
        </Box>

        {server.error && (
          <Text style={{ fontSize: 11, color: '#fca5a5' }}>{`Error: ${server.error}`}</Text>
        )}

        <Box style={{ backgroundColor: '#1e293b', borderRadius: 6, padding: 8, gap: 3 }}>
          <Text style={{ fontSize: 10, color: '#64748b' }}>Server log:</Text>
          {serverLog.length === 0 && (
            <Text style={{ fontSize: 10, color: '#475569' }}>No messages yet</Text>
          )}
          {serverLog.map((msg, i) => (
            <Text key={i} style={{ fontSize: 10, color: '#a5b4fc' }}>{msg}</Text>
          ))}
        </Box>
      </Box>

      {/* Client panel */}
      <Box style={{ flexGrow: 1, gap: 8 }}>
        <Text style={{ fontSize: 14, color: '#f1f5f9' }}>Client (Joiner)</Text>

        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <StatusDot status={client.status} />
          <Text style={{ fontSize: 12, color: '#e2e8f0' }}>{`Status: ${client.status}`}</Text>
        </Box>

        <Text style={{ fontSize: 11, color: onionAddr ? '#22c55e' : '#94a3b8' }}>
          {onionAddr ? `Tor ready: ${onionAddr.substring(0, 20)}...` : 'Waiting for Tor...'}
        </Text>

        <Box style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable onPress={connectClient} style={{
            backgroundColor: clientUrl && !clientUrl.includes('.onion') ? '#334155' : '#3b82f6',
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Connect Local</Text>
          </Pressable>

          <Pressable onPress={connectViaTor} style={{
            backgroundColor: !onionAddr ? '#1e293b' : clientUrl && clientUrl.includes('.onion') ? '#334155' : '#8b5cf6',
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Connect via Tor</Text>
          </Pressable>

          <Pressable onPress={disconnectClient} style={{
            backgroundColor: clientUrl ? '#ef4444' : '#334155',
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Disconnect</Text>
          </Pressable>

          <Pressable onPress={clientSend} style={{
            backgroundColor: client.status === 'open' ? '#10b981' : '#334155',
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
          }}>
            <Text style={{ fontSize: 11, color: '#ffffff' }}>Send</Text>
          </Pressable>
        </Box>

        {onionAddr && (
          <Box style={{ backgroundColor: '#1e293b', borderRadius: 6, padding: 6 }}>
            <Text style={{ fontSize: 9, color: '#64748b' }}>Onion address:</Text>
            <Text style={{ fontSize: 10, color: '#a5b4fc' }}>{onionAddr}</Text>
          </Box>
        )}

        {client.error && (
          <Text style={{ fontSize: 11, color: '#fca5a5' }}>{`Error: ${client.error}`}</Text>
        )}

        <Box style={{ backgroundColor: '#1e293b', borderRadius: 6, padding: 8, gap: 3 }}>
          <Text style={{ fontSize: 10, color: '#64748b' }}>Client log:</Text>
          {clientLog.length === 0 && (
            <Text style={{ fontSize: 10, color: '#475569' }}>No messages yet</Text>
          )}
          {clientLog.map((msg, i) => (
            <Text key={i} style={{ fontSize: 10, color: '#a5b4fc' }}>{msg}</Text>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export function WebSocketStory() {
  return (
    <Box style={{
      width: '100%', height: '100%',
      padding: 20, gap: 16,
      backgroundColor: '#0f172a',
    }}>
      <Text style={{ fontSize: 18, color: '#f1f5f9' }}>WebSocket — P2P Server + Client</Text>
      <Text style={{ fontSize: 12, color: '#64748b' }}>
        {`Start the server, then connect the client. Messages echo back through the server.`}
      </Text>

      <P2PDemo />
    </Box>
  );
}
