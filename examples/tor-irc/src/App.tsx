import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Text, Pressable, ScrollView, TextInput, Modal,
  useLoveRPC, useLoveEvent, usePeerServer, useClipboard,
} from '@ilovereact/core';

// ─── Types ────────────────────────────────────────────────────────────────────

type TorStatus = 'bootstrapping' | 'ready' | 'error';
type PeerStatus = 'connecting' | 'open' | 'closed';

interface Peer {
  onion: string;
  nick: string;
  direction: 'in' | 'out';
  status: PeerStatus;
  clientId?: number;
}

interface ChatMsg {
  id: string;
  nick: string;
  text: string;
  ts: number;
  self: boolean;
  system: boolean;
}

type IRCPacket =
  | { type: 'hello'; nick: string; onion: string }
  | { type: 'msg'; text: string; ts: number }
  | { type: 'part' };

// ─── Constants ────────────────────────────────────────────────────────────────

const IRC_PORT = 6667;

const C = {
  bg:           '#0d1117',
  surface:      '#161b22',
  surfaceHi:    '#1c2128',
  border:       '#30363d',
  text:         '#e6edf3',
  dim:          '#8b949e',
  accent:       '#58a6ff',
  success:      '#3fb950',
  warning:      '#d29922',
  error:        '#f85149',
  onion:        '#a78bfa',
  selfNick:     '#f0abfc',
  system:       '#6e7681',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNick(onion: string): string {
  return onion.replace(/\.onion$/, '').substring(0, 8);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function abbrevOnion(onion: string): string {
  const base = onion.replace(/\.onion$/, '');
  if (base.length <= 14) return onion;
  return `${base.slice(0, 6)}...${base.slice(-6)}.onion`;
}

// ─── StatusDot ────────────────────────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
  );
}

function torDotColor(status: TorStatus): string {
  return status === 'ready' ? C.success : status === 'bootstrapping' ? C.warning : C.error;
}

function peerDotColor(status: PeerStatus): string {
  return status === 'open' ? C.success : status === 'connecting' ? C.warning : C.error;
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  myOnion: string | null;
  torStatus: TorStatus;
  serverReady: boolean;
}

function Header({ myOnion, torStatus, serverReady }: HeaderProps) {
  const { copy, copied } = useClipboard();

  const statusLabel =
    torStatus === 'bootstrapping' ? 'Bootstrapping Tor...' :
    torStatus === 'error'         ? 'Tor failed to start'  :
    myOnion ? abbrevOnion(myOnion) : '';

  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      height: 48,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderColor: C.border,
      paddingLeft: 16,
      paddingRight: 12,
      gap: 10,
    }}>
      {/* Logo */}
      <Text style={{ fontSize: 13, fontWeight: '700', color: C.onion }}>TOR IRC</Text>

      <Box style={{ width: 1, height: 20, backgroundColor: C.border }} />

      {/* Tor status */}
      <StatusDot color={torDotColor(torStatus)} />
      <Text style={{ fontSize: 11, color: torStatus === 'ready' ? C.onion : C.dim, flexGrow: 1 }}>
        {statusLabel}
      </Text>

      {/* Copy address */}
      {myOnion && (
        <Pressable
          onPress={() => copy(myOnion)}
          style={(s) => ({
            paddingLeft: 10, paddingRight: 10,
            paddingTop: 5, paddingBottom: 5,
            borderRadius: 5,
            borderWidth: 1,
            borderColor: copied ? C.success : C.border,
            backgroundColor: s.pressed ? C.surfaceHi : 'transparent',
          })}
        >
          <Text style={{ fontSize: 11, color: copied ? C.success : C.dim }}>
            {copied ? 'Copied!' : 'Copy address'}
          </Text>
        </Pressable>
      )}

      {/* Server status */}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <StatusDot color={serverReady ? C.success : C.warning} />
        <Text style={{ fontSize: 10, color: C.dim }}>
          {serverReady ? `:${IRC_PORT}` : 'server...'}
        </Text>
      </Box>
    </Box>
  );
}

// ─── PeerItem ─────────────────────────────────────────────────────────────────

function PeerItem({ peer }: { peer: Peer }) {
  const dirIcon = peer.direction === 'in' ? 'in' : 'out';

  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 12, paddingRight: 8,
      paddingTop: 7, paddingBottom: 7,
      gap: 7,
    }}>
      <StatusDot color={peerDotColor(peer.status)} />
      <Box style={{ flexGrow: 1, gap: 2 }}>
        <Text style={{ fontSize: 12, color: C.text }}>{peer.nick}</Text>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 9, color: C.dim }}>{dirIcon}</Text>
          <Text style={{ fontSize: 9, color: C.dim }}>{abbrevOnion(peer.onion)}</Text>
        </Box>
      </Box>
    </Box>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  peers: Peer[];
  onAddPeer: () => void;
}

function Sidebar({ peers, onAddPeer }: SidebarProps) {
  return (
    <Box style={{
      width: 200,
      height: '100%',
      backgroundColor: C.surface,
      borderRightWidth: 1,
      borderColor: C.border,
      flexDirection: 'column',
    }}>
      {/* Section label */}
      <Box style={{
        paddingLeft: 12, paddingRight: 12,
        paddingTop: 9, paddingBottom: 8,
        borderBottomWidth: 1,
        borderColor: C.border,
      }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: C.dim }}>
          {`PEERS (${peers.length})`}
        </Text>
      </Box>

      {/* Peer list */}
      <ScrollView style={{ flexGrow: 1 }}>
        {peers.length === 0 ? (
          <Box style={{ padding: 14 }}>
            <Text style={{ fontSize: 11, color: C.dim }}>No connections.</Text>
            <Text style={{ fontSize: 10, color: C.system }}>
              {'Add a peer below or share your\naddress with someone.'}
            </Text>
          </Box>
        ) : (
          peers.map(p => (
            <PeerItem key={`${p.direction}-${p.onion}-${p.clientId ?? ''}`} peer={p} />
          ))
        )}
      </ScrollView>

      {/* Add peer */}
      <Pressable
        onPress={onAddPeer}
        style={(s) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 44,
          width: '100%',
          borderTopWidth: 1,
          borderColor: C.border,
          backgroundColor: s.pressed ? C.surfaceHi : s.hovered ? C.surfaceHi : 'transparent',
        })}
      >
        <Box style={{
          width: 16, height: 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: C.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 12, color: C.accent, lineHeight: 14 }}>+</Text>
        </Box>
        <Text style={{ fontSize: 12, color: C.accent }}>Add peer</Text>
      </Pressable>
    </Box>
  );
}

// ─── MessageLine ──────────────────────────────────────────────────────────────

function MessageLine({ msg }: { msg: ChatMsg }) {
  if (msg.system) {
    return (
      <Box style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 1, paddingBottom: 1 }}>
        <Text style={{ fontSize: 10, color: C.system }}>{`-- ${msg.text} --`}</Text>
      </Box>
    );
  }

  const timeStr = formatTime(msg.ts);
  const nickColor = msg.self ? C.selfNick : C.accent;

  return (
    <Box style={{
      flexDirection: 'row',
      paddingLeft: 14, paddingRight: 14,
      paddingTop: 3, paddingBottom: 3,
      gap: 6,
      alignItems: 'flex-start',
    }}>
      <Text style={{ fontSize: 10, color: C.dim, width: 38 }}>{timeStr}</Text>
      <Text style={{ fontSize: 12, color: nickColor, width: 90, fontWeight: msg.self ? '700' : '400' }}>
        {`<${msg.nick}>`}
      </Text>
      <Text style={{ fontSize: 12, color: C.text, flexGrow: 1 }}>{msg.text}</Text>
    </Box>
  );
}

// ─── MessageArea ──────────────────────────────────────────────────────────────

function MessageArea({ messages }: { messages: ChatMsg[] }) {
  return (
    <ScrollView style={{ flexGrow: 1, backgroundColor: C.bg }}>
      {messages.length === 0 ? (
        <Box style={{ padding: 24, alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 13, color: C.dim }}>
            No messages yet.
          </Text>
          <Text style={{ fontSize: 11, color: C.system }}>
            Share your address and connect to a peer to begin.
          </Text>
        </Box>
      ) : (
        messages.map(m => <MessageLine key={m.id} msg={m} />)
      )}
    </ScrollView>
  );
}

// ─── InputBar ─────────────────────────────────────────────────────────────────

interface InputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
}

function InputBar({ value, onChange, onSend, disabled }: InputBarProps) {
  return (
    <Box style={{
      flexDirection: 'row',
      alignItems: 'center',
      height: 50,
      width: '100%',
      backgroundColor: C.surface,
      borderTopWidth: 1,
      borderColor: C.border,
      paddingLeft: 14, paddingRight: 12,
      gap: 8,
    }}>
      <Text style={{ fontSize: 13, color: disabled ? C.system : C.dim }}>{'>'}</Text>

      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSend}
        placeholder={disabled ? 'Waiting for Tor...' : 'Type a message and press Enter'}
        style={{
          flexGrow: 1,
          fontSize: 13,
          color: C.text,
          backgroundColor: 'transparent',
        }}
      />

      <Pressable
        onPress={onSend}
        style={(s) => ({
          paddingLeft: 18, paddingRight: 18,
          paddingTop: 7, paddingBottom: 7,
          borderRadius: 6,
          backgroundColor: disabled
            ? C.border
            : s.pressed ? '#1d4ed8'
            : s.hovered ? '#3b82f6'
            : C.accent,
        })}
      >
        <Text style={{ fontSize: 12, color: disabled ? C.dim : '#ffffff', fontWeight: '700' }}>
          SEND
        </Text>
      </Pressable>
    </Box>
  );
}

// ─── AddPeerModal ─────────────────────────────────────────────────────────────

interface AddPeerModalProps {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  torReady: boolean;
}

function AddPeerModal({ value, onChange, onConfirm, onCancel, torReady }: AddPeerModalProps) {
  return (
    <Modal visible onDismiss={onCancel}>
      <Box style={{
        width: 460,
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
        padding: 24,
        gap: 16,
      }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>Connect to Peer</Text>

        <Text style={{ fontSize: 12, color: C.dim }}>
          Paste the .onion address shared by the other user.
          They need to be online and hosting on port 6667.
        </Text>

        {!torReady && (
          <Box style={{
            backgroundColor: '#291a00',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: C.warning,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 8, paddingBottom: 8,
          }}>
            <Text style={{ fontSize: 11, color: C.warning }}>
              Tor is still bootstrapping. Connections will be queued.
            </Text>
          </Box>
        )}

        <TextInput
          value={value}
          onChangeText={onChange}
          onSubmitEditing={onConfirm}
          placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.onion"
          style={{
            fontSize: 12,
            color: C.onion,
            backgroundColor: C.bg,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: C.border,
            paddingLeft: 12, paddingRight: 12,
            paddingTop: 9, paddingBottom: 9,
          }}
        />

        <Box style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <Pressable
            onPress={onCancel}
            style={(s) => ({
              paddingLeft: 16, paddingRight: 16,
              paddingTop: 8, paddingBottom: 8,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: C.border,
              backgroundColor: s.pressed ? C.surfaceHi : 'transparent',
            })}
          >
            <Text style={{ fontSize: 12, color: C.dim }}>Cancel</Text>
          </Pressable>

          <Pressable
            onPress={onConfirm}
            style={(s) => ({
              paddingLeft: 16, paddingRight: 16,
              paddingTop: 8, paddingBottom: 8,
              borderRadius: 6,
              backgroundColor: s.pressed ? '#1d4ed8' : s.hovered ? '#3b82f6' : C.accent,
            })}
          >
            <Text style={{ fontSize: 12, color: '#ffffff', fontWeight: '700' }}>Connect</Text>
          </Pressable>
        </Box>
      </Box>
    </Modal>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  // ── Tor ────────────────────────────────────────────────────────────────────
  const [myOnion, setMyOnion] = useState<string | null>(null);
  const [torStatus, setTorStatus] = useState<TorStatus>('bootstrapping');
  const getHostname = useLoveRPC<string>('tor:getHostname');

  // Query once on mount — catches case where Tor was already ready
  useEffect(() => {
    getHostname().then(h => {
      if (h) { setMyOnion(h); setTorStatus('ready'); }
    }).catch(() => {});
  }, []);

  // Fires when Tor finishes bootstrapping after mount
  useLoveEvent('tor:ready', (payload: any) => {
    if (payload?.hostname) {
      setMyOnion(payload.hostname);
      setTorStatus('ready');
    }
  });

  const myNickRef = useRef<string>('???');
  const myOnionRef = useRef<string | null>(null);
  myNickRef.current = myOnion ? getNick(myOnion) : '???';
  myOnionRef.current = myOnion;

  // ── Server (accepts incoming peers) ────────────────────────────────────────
  const server = usePeerServer(IRC_PORT);

  // ── Chat state ─────────────────────────────────────────────────────────────
  const [peers, setPeers] = useState<Peer[]>([]);
  const peersRef = useRef<Peer[]>([]);
  peersRef.current = peers;

  const [messages, setMessages] = useState<ChatMsg[]>([]);

  const addMsg = useCallback((nick: string, text: string, self: boolean, system = false) => {
    setMessages(prev => [...prev, { id: makeId(), nick, text, ts: Date.now(), self, system }]);
  }, []);

  // ── Outgoing connections (one WebSocket per peer we dialed) ────────────────
  const outgoingRef = useRef<Map<string, WebSocket>>(new Map());

  // ── Handle server peer connect / disconnect ────────────────────────────────
  const prevServerPeers = useRef<number[]>([]);
  useEffect(() => {
    const prev = prevServerPeers.current;
    const curr = server.peers;

    for (const id of curr.filter(id => !prev.includes(id))) {
      setPeers(p =>
        p.some(x => x.clientId === id) ? p :
        [...p, { onion: 'unknown.onion', nick: `peer${id}`, direction: 'in', status: 'connecting', clientId: id }]
      );
    }

    for (const id of prev.filter(id => !curr.includes(id))) {
      const peer = peersRef.current.find(p => p.clientId === id);
      if (peer && !peer.onion.startsWith('unknown')) {
        addMsg('', `${peer.nick} disconnected`, false, true);
      }
      setPeers(p => p.filter(x => x.clientId !== id));
    }

    prevServerPeers.current = curr;
  }, [server.peers]);

  // ── Handle messages from incoming peers ───────────────────────────────────
  useEffect(() => {
    if (!server.lastMessage) return;
    const { clientId, data } = server.lastMessage;

    let packet: IRCPacket;
    try { packet = JSON.parse(data); } catch { return; }

    if (packet.type === 'hello') {
      // Update placeholder with real identity, then reply
      setPeers(p => p.map(x =>
        x.clientId === clientId
          ? { ...x, nick: packet.nick, onion: packet.onion, status: 'open' }
          : x
      ));
      addMsg('', `${packet.nick} connected`, false, true);
      server.send(clientId, JSON.stringify({
        type: 'hello',
        nick: myNickRef.current,
        onion: myOnionRef.current ?? 'unknown',
      } satisfies IRCPacket));

    } else if (packet.type === 'msg') {
      const peer = peersRef.current.find(p => p.clientId === clientId);
      addMsg(peer?.nick ?? `peer${clientId}`, packet.text, false);

    } else if (packet.type === 'part') {
      const peer = peersRef.current.find(p => p.clientId === clientId);
      addMsg('', `${peer?.nick ?? 'peer'} left`, false, true);
      setPeers(p => p.filter(x => x.clientId !== clientId));
    }
  }, [server.lastMessage]);

  // ── Connect to a peer by .onion address ───────────────────────────────────
  const connectToPeer = useCallback((rawAddr: string) => {
    const onion = rawAddr.trim().toLowerCase().endsWith('.onion')
      ? rawAddr.trim().toLowerCase()
      : rawAddr.trim().toLowerCase() + '.onion';

    if (outgoingRef.current.has(onion)) return;

    const nick = getNick(onion);
    setPeers(p => [...p, { onion, nick, direction: 'out', status: 'connecting' }]);
    addMsg('', `Connecting to ${nick}...`, false, true);

    const ws = new WebSocket(`ws://${onion}:${IRC_PORT}`);
    outgoingRef.current.set(onion, ws);

    ws.onopen = () => {
      setPeers(p => p.map(x => x.onion === onion ? { ...x, status: 'open' } : x));
      ws.send(JSON.stringify({
        type: 'hello',
        nick: myNickRef.current,
        onion: myOnionRef.current ?? 'unknown',
      } satisfies IRCPacket));
    };

    ws.onmessage = (e: MessageEvent) => {
      let packet: IRCPacket;
      try { packet = JSON.parse(typeof e.data === 'string' ? e.data : String(e.data)); }
      catch { return; }

      if (packet.type === 'hello') {
        setPeers(p => p.map(x => x.onion === onion ? { ...x, nick: packet.nick, status: 'open' } : x));
        addMsg('', `${packet.nick} accepted your connection`, false, true);

      } else if (packet.type === 'msg') {
        const peer = peersRef.current.find(p => p.onion === onion);
        addMsg(peer?.nick ?? nick, packet.text, false);

      } else if (packet.type === 'part') {
        addMsg('', `${nick} left`, false, true);
        setPeers(p => p.filter(x => x.onion !== onion));
        outgoingRef.current.delete(onion);
      }
    };

    ws.onclose = () => {
      addMsg('', `${nick} disconnected`, false, true);
      setPeers(p => p.filter(x => x.onion !== onion));
      outgoingRef.current.delete(onion);
    };

    ws.onerror = () => {
      addMsg('', `Failed to connect to ${nick}`, false, true);
      setPeers(p => p.map(x => x.onion === onion ? { ...x, status: 'closed' } : x));
      outgoingRef.current.delete(onion);
    };
  }, [addMsg]);

  // ── Send a message to all connected peers ─────────────────────────────────
  const [inputText, setInputText] = useState('');

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !myOnionRef.current) return;
    setInputText('');

    addMsg(myNickRef.current, text, true);

    const payload = JSON.stringify({ type: 'msg', text, ts: Date.now() } satisfies IRCPacket);
    server.broadcast(payload);
    for (const ws of outgoingRef.current.values()) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }, [inputText, server, addMsg]);

  // ── Add peer modal ─────────────────────────────────────────────────────────
  const [showAddPeer, setShowAddPeer] = useState(false);
  const [addPeerInput, setAddPeerInput] = useState('');

  const handleAddPeer = useCallback(() => {
    const addr = addPeerInput.trim();
    if (!addr) return;
    connectToPeer(addr);
    setAddPeerInput('');
    setShowAddPeer(false);
  }, [addPeerInput, connectToPeer]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const myNick = myNickRef.current;

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: C.bg, flexDirection: 'column' }}>

      <Header myOnion={myOnion} torStatus={torStatus} serverReady={server.ready} />

      <Box style={{ flexDirection: 'row', flexGrow: 1 }}>

        <Sidebar peers={peers} onAddPeer={() => setShowAddPeer(true)} />

        {/* Chat area */}
        <Box style={{ flexGrow: 1, flexDirection: 'column' }}>

          {/* Channel header */}
          <Box style={{
            height: 34,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 14, paddingRight: 14,
            borderBottomWidth: 1,
            borderColor: C.border,
            backgroundColor: C.surface,
            gap: 8,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.dim }}>#general</Text>
            <Text style={{ fontSize: 10, color: C.system }}>
              {`${peers.filter(p => p.status === 'open').length} connected`}
            </Text>
            <Box style={{ flexGrow: 1 }} />
            <Text style={{ fontSize: 10, color: myOnion ? C.onion : C.system }}>
              {myOnion ? `you: ${myNick}` : 'identifying...'}
            </Text>
          </Box>

          <MessageArea messages={messages} />

          <InputBar
            value={inputText}
            onChange={setInputText}
            onSend={sendMessage}
            disabled={!myOnion}
          />

        </Box>
      </Box>

      {showAddPeer && (
        <AddPeerModal
          value={addPeerInput}
          onChange={setAddPeerInput}
          onConfirm={handleAddPeer}
          onCancel={() => { setShowAddPeer(false); setAddPeerInput(''); }}
          torReady={torStatus === 'ready'}
        />
      )}

    </Box>
  );
}
