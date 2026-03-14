/**
 * Networking — Package documentation page (Layout2 zigzag narrative).
 *
 * Consolidates all networking capabilities: useFetch, useWebSocket,
 * usePeerServer, useScrape, useServer, useRSSFeed, Tor, webhooks.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, Input, classifiers as S} from '../../../packages/core/src';
import { useScrape } from '../../../packages/core/src/useScrape';
import { useThemeColors } from '../../../packages/theme/src';
import {ExternalDependencyNotice, PageColumn} from './_shared/StoryScaffold';

// ── Palette ──────────────────────────────────────────────

const C = {
  accent: '#22d3ee',
  accentDim: 'rgba(34, 211, 238, 0.12)',
  callout: 'rgba(59, 130, 246, 0.08)',
  calloutBorder: 'rgba(59, 130, 246, 0.25)',
  ws: '#a78bfa',
  tor: '#f472b6',
  server: '#34d399',
  rss: '#fb923c',
  gameserver: '#f59e0b',
  wgKernel: '#6366f1',
  wgUser: '#10b981',
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useFetch, useWebSocket, usePeerServer } from '@reactjit/core'
import { useScrape } from '@reactjit/core'
import { useServer, useStaticServer, useLibrary } from '@reactjit/server'
import { GameServer, useGameServer, usePlayerList } from '@reactjit/networking'
import { useRSSFeed, useRSSAggregate } from '@reactjit/rss'
import { useWebhook, sendWebhook } from '@reactjit/webhooks'
import { useWireGuard, usePeerTunnel } from '@reactjit/wireguard'`;

const FETCH_CODE = `// Universal fetch — returns { data, loading, error }
const { data, loading, error } = useFetch<User[]>(
  'https://api.example.com/users'
)

// Conditional fetch — pass null to skip
const { data } = useFetch(userId ? \`/api/users/\${userId}\` : null)`;

const WEBSOCKET_CODE = `// Persistent connection with auto-reconnect
const { status, send, lastMessage, error } = useWebSocket(
  'wss://stream.example.com/live'
)

// status: 'connecting' | 'open' | 'closed' | 'error'
send(JSON.stringify({ type: 'subscribe', channel: 'prices' }))`;

const PEER_SERVER_CODE = `// Host a WebSocket server from your app
const { ready, peers, broadcast, send, lastMessage } = usePeerServer(8080)

// Send to one peer or broadcast to all
send(clientId, JSON.stringify({ type: 'update', data }))
broadcast(JSON.stringify({ type: 'sync', state: gameState }))`;

const GAME_SERVER_CODE = `// CS 1.6 (GoldSrc)
<GameServer type="goldsrc" config={{ port: 27015, game: "cstrike", map: "de_dust2" }} />

// CS:S / TF2 / GMod (Source)
<GameServer type="source" config={{
  port: 27015, game: "cstrike", map: "de_dust2",
  maxPlayers: 24, rconPassword: "secret",
  mapRotation: ["de_dust2", "de_inferno", "de_nuke"],
}} />

// CS2 (Source 2)
<GameServer type="source2" config={{ port: 27015, game: "cs2", map: "de_dust2" }} />

// Minecraft (Java Edition)
<GameServer type="minecraft" config={{
  port: 25565, maxPlayers: 20,
  difficulty: "normal", gameType: "survival",
  rconPassword: "admin", memory: "4G",
}} />`;

const GAME_SERVER_HOOKS_CODE = `// Full server management — start, stop, RCON, live status
const server = useGameServer()
// server.state: 'stopped' | 'starting' | 'running' | 'error'
// server.status: { online, name, map, players, maxPlayers, bots }
// server.players: [{ id, name, score, duration }]
// server.logs: [{ timestamp, level, message }]

server.rcon('sv_maxrate 128')        // raw RCON command
server.kick('griefer', 'no griefing') // kick by name
server.changeMap('de_inferno')        // changelevel via RCON
server.say('Server restarting in 5m') // server chat

// Persisted config — survives app restarts
const [config, setConfig] = useLocalStore('my-server', defaults)
<GameServer type="source" config={config} />
// setConfig({ ...config, map: "de_nuke" }) -> Lua sees new props -> RCON changelevel`;

const SCRAPE_CODE = `// Expert mode — you know CSS selectors
const { data } = useScrape('https://news.example.com', {
  title: 'h1',
  price: '.product-price',
  link:  'a@href',          // extract attribute
  hero:  'img.hero@src',    // image source
})

// Guided mode — browse elements, pick by ID
const scrape = useScrape('https://news.example.com')
// scrape.elements = [{ id: 1, tag: 'h1', text: '...' }, ...]
scrape.pick({ title: 1, link: { id: 3, attr: 'href' } })`;

const SERVER_CODE = `// Full HTTP server with static files + API routes
const server = useServer({
  port: 8080,
  static: [{ path: '/assets', root: '/home/user/public' }],
  routes: [{
    path: '/api/status',
    handler: (req) => ({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ up: true, peers: 42 }),
    }),
  }],
})

// One-liner static file server
const files = useStaticServer(3000, '/home/user/website')

// Indexed media library with search API
const lib = useLibrary(9000, ['/home/user/music', '/home/user/videos'])
// GET /api/library?type=audio&q=beethoven`;

const TOR_CODE = `// Tor hidden service — bootstrapped by the Lua runtime
// SOCKS5 proxy for .onion WebSocket connections
const { status, send } = useWebSocket(
  'ws://abc123def456.onion/chat'  // auto-routed through Tor SOCKS5
)

// Tor status via RPC
const getHostname = useLoveRPC('tor:getHostname')
const hostname = await getHostname()
// => 'abc123def456ghij.onion'

// HTTP through Tor — uses ALL_PROXY env
const { data } = useFetch('http://hidden-service.onion/api')`;

const RSS_CODE = `// Single feed subscription
const { items, feed, loading } = useRSSFeed(
  'https://hnrss.org/frontpage',
  { interval: 60000, limit: 20 }  // poll every 60s, cap at 20
)

// Multi-feed aggregation — merged + sorted by date
const { items, feeds } = useRSSAggregate([
  'https://hnrss.org/frontpage',
  'https://lobste.rs/rss',
  'https://blog.rust-lang.org/feed.xml',
], { limit: 50 })`;

const WEBHOOK_CODE = `// Receive webhooks on your server
const { events, error } = useWebhook({
  port: 9090,
  path: '/hooks/github',
  secret: process.env.WEBHOOK_SECRET,
})

// Send a webhook
await sendWebhook('https://hooks.slack.com/xxx', {
  body: { text: 'Deploy complete!' },
  secret: 'signing-key',
})

// HMAC verification
import { hmacSHA256, timingSafeEqual } from '@reactjit/webhooks'
const sig = hmacSHA256(secret, payload)`;

const SPOTIFY_CODE = `// Now playing — wires to Spotify Web API
const { track, playing, progress } = useSpotifyNowPlaying(token)
// => { title: 'Midnight City', artist: 'M83', album: "Hurry Up..." }

// Top artists / tracks (Last.fm or Spotify)
const { artists } = useLastFMTopArtists(user, { period: '7day' })
// Pre-built components:
<NowPlayingCard title={track.title} artist={track.artist} playing />
<TrackRow rank={1} title="Midnight City" artist="M83" nowPlaying />
<ArtistRow rank={1} name="M83" playcount={4210} />`;

const MEDIA_CODE = `// TMDB movie / show lookup
const { results } = useTMDBSearch('Dune', { type: 'movie' })
const { details } = useTMDBDetails(movieId)

// Pre-built card with poster, score badge, and year
<MediaPosterCard title="Dune: Part Two" score={8.3} year="2024"
  posterUrl={tmdbImage(details.poster_path)} />`;

const CRYPTO_CODE = `// Live coin market data from CoinGecko
const { coins } = useCoinMarkets({ vs: 'usd', limit: 20 })
// coins = [{ symbol, name, price, change24h, sparkline }]

// Compact ticker row with optional sparkline chart
<CoinTickerRow symbol="BTC" name="Bitcoin"
  price={68420} change24h={2.41} sparkline={prices} />`;

const GITHUB_CODE = `// GitHub user profile + repos + activity
const { user } = useGitHubUser('siah')
const { repos } = useGitHubRepos('siah', { sort: 'stars' })
const { events } = useGitHubEvents('siah')

// Pre-built components
<GitHubUserCard login="siah" name="Siah" repos={42} followers={380} />
<RepoCard name="reactjit" description="..." language="TypeScript" stars={1842} />
<StatCard label="Stars" value="12.4k" trend={5.2} accent="#f59e0b" />
<ActivityRow dot="#6366f1" label="Pushed 3 commits" time="2m ago" />`;

const NASA_CODE = `// NASA Astronomy Picture of the Day
const { apod } = useNASAAPOD()  // DEMO_KEY built-in
// => { title, date, imageUrl, explanation, copyright }

// Zero-config one-liner
<APOD />

// Or manual with APODCard
<APODCard title={apod.title} imageUrl={apod.imageUrl}
  explanation={apod.explanation} />`;

const HUE_CODE = `// Philips Hue bridge discovery + light control
const { lights, toggle, setBrightness } = useHueLights(bridgeIp)
// lights = [{ id, name, on, color, brightness }]

// Live color badge
<HueLightBadge name="Desk Lamp" on={true}
  color={hueXYToHex(light.xy)} brightness={0.85} />`;

const PROXY_CODE = `// HTTP requests through proxies (Lua-side, zero JS overhead)
// Supports HTTP, HTTPS, SOCKS5 proxies
// Set via environment variables:
//   HTTP_PROXY=http://proxy:8080
//   HTTPS_PROXY=http://proxy:8080
//   ALL_PROXY=socks5://localhost:9050  (Tor)
//   NO_PROXY=localhost,127.0.0.1

// Or per-request in Lua:
// http.request(id, {
//   url = 'https://api.example.com',
//   proxy = { host='127.0.0.1', port=9050, type='socks5' }
// })`;

const WG_PEER_TUNNEL_CODE = `// Userspace encrypted P2P — no root, no system deps
const tunnel = usePeerTunnel({
  privateKey: myKey,
  stunServer: 'stun.l.google.com',  // NAT traversal
})

// After signaling exchange (WebSocket, QR, manual):
tunnel.addPeer(theirPublicKey, '1.2.3.4:9000')

// Send encrypted data (XChaCha20-Poly1305)
tunnel.send(theirPublicKey, 'hello')
tunnel.broadcast(JSON.stringify({ type: 'sync', state }))

// tunnel.lastMessage = { publicKey, data }
// tunnel.peers = [{ publicKey, endpoint, state }]`;

const WG_KERNEL_CODE = `// Real kernel WireGuard — keys never in process memory
const wg = useWireGuard('wg-rjit0')

const keys = await wg.generateKeys()  // via wg genkey
await wg.up({
  privateKey: keys.privateKey,
  listenPort: 51820,
  address: '10.0.0.1/24',
  peers: [{
    publicKey: peerKey,
    endpoint: '1.2.3.4:51820',
    allowedIPs: '10.0.0.2/32',
    keepalive: 25,
  }],
})
// wg.status — live stats, wg.down() — tear down`;

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <S.StoryDivider />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <S.RowCenterG6>
      <S.StorySectionIcon src={icon} tintColor={C.accent} />
      <S.StoryLabelText>
        {children}
      </S.StoryLabelText>
    </S.RowCenterG6>
  );
}

// ── Scrape live demo ────────────────────────────────────

const SCRAPE_PRESETS: { label: string; url: string; selectors: Record<string, string> }[] = [
  { label: 'Example.com', url: 'https://example.com', selectors: { title: 'h1', description: 'p:first', link: 'a@href' } },
  { label: 'HN', url: 'https://news.ycombinator.com', selectors: { title: '.titleline a', score: '.score', site: '.sitestr' } },
  { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Lua_(programming_language)', selectors: { title: 'h1', summary: '.mw-parser-output > p:first', infobox: '.infobox th' } },
];

function ScrapeDemo() {
  const c = useThemeColors();
  const [url, setUrl] = useState(SCRAPE_PRESETS[0].url);
  const [selectors, setSelectors] = useState(SCRAPE_PRESETS[0].selectors);
  const [activeUrl, setActiveUrl] = useState<string | null>(SCRAPE_PRESETS[0].url);
  const { data, loading, error, refetch } = useScrape(activeUrl, selectors);

  const handlePreset = (p: typeof SCRAPE_PRESETS[number]) => {
    setUrl(p.url);
    setSelectors(p.selectors);
    setActiveUrl(p.url);
  };

  const handleGo = () => setActiveUrl(url);

  return (
    <Box style={{ gap: 10 }}>
      {/* Preset buttons */}
      <S.RowG6 style={{ flexWrap: 'wrap' }}>
        {SCRAPE_PRESETS.map(p => (
          <Pressable key={p.label} onPress={() => handlePreset(p)}>
            <Box style={{
              backgroundColor: activeUrl === p.url ? C.accent : C.accentDim,
              paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4,
              borderRadius: 4,
            }}>
              <Text style={{ fontSize: 9, color: activeUrl === p.url ? '#1e1e2e' : C.accent }}>{p.label}</Text>
            </Box>
          </Pressable>
        ))}
      </S.RowG6>

      {/* URL bar */}
      <S.RowCenterG6>
        <Box style={{ flexGrow: 1 }}>
          <Input
            value={url}
            onChangeText={setUrl}
            onSubmit={handleGo}
            placeholder="https://..."
            style={{ fontSize: 10, fontFamily: 'monospace' }}
          />
        </Box>
        <Pressable onPress={handleGo}>
          <Box style={{ backgroundColor: C.accent, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 4 }}>
            <Text style={{ fontSize: 9, color: '#1e1e2e', fontWeight: 'bold' }}>{'Go'}</Text>
          </Box>
        </Pressable>
      </S.RowCenterG6>

      {/* Selectors being used */}
      <S.RowWrap style={{ gap: 4 }}>
        {Object.entries(selectors).map(([k, v]) => (
          <Box key={k} style={{ backgroundColor: C.accentDim, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3 }}>
            <Text style={{ fontSize: 8, color: C.accent, fontFamily: 'monospace' }}>{`${k}: '${v}'`}</Text>
          </Box>
        ))}
      </S.RowWrap>

      {/* Results */}
      {loading ? (
        <S.RowCenterG6>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.rss }} />
          <Text style={{ fontSize: 10, color: C.rss }}>{'Scraping...'}</Text>
        </S.RowCenterG6>
      ) : error ? (
        <S.RowCenterG6>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.tor }} />
          <Text style={{ fontSize: 10, color: C.tor }}>{error}</Text>
        </S.RowCenterG6>
      ) : data ? (
        <Box style={{ gap: 3 }}>
          {Object.entries(data).map(([key, value]) => {
            const display = value == null ? 'null'
              : Array.isArray(value) ? `[${value.length}] ${value.slice(0, 3).join(' \u2022 ')}${value.length > 3 ? ' ...' : ''}`
              : String(value).length > 120 ? String(value).slice(0, 120) + '\u2026'
              : String(value);
            return (
              <S.RowG8 key={key}>
                <Box style={{ width: 70 }}>
                  <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{key}</Text>
                </Box>
                <S.StoryBreadcrumbActive style={{ flexShrink: 1 }}>{display}</S.StoryBreadcrumbActive>
              </S.RowG8>
            );
          })}
        </Box>
      ) : null}

      {/* Refetch */}
      {data ? (
        <Pressable onPress={refetch}>
          <Box style={{ backgroundColor: C.accentDim, paddingLeft: 10, paddingRight: 10, paddingTop: 4, paddingBottom: 4, borderRadius: 4, alignSelf: 'start' }}>
            <Text style={{ color: C.accent, fontSize: 9 }}>{'Refetch'}</Text>
          </Box>
        </Pressable>
      ) : null}
    </Box>
  );
}

// ── NetworkingStory ─────────────────────────────────────

export function NetworkingStory() {
  const c = useThemeColors();

  return (
    <S.StoryRoot>

      {/* ── Header ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderBottomWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
        <S.StoryHeaderIcon src="globe" tintColor={C.accent} />
        <S.StoryTitle>
          {'Networking'}
        </S.StoryTitle>
        <Box style={{
          backgroundColor: C.accentDim,
          borderRadius: 4,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
        }}>
          <Text style={{ color: C.accent, fontSize: 10 }}>{'multi-package'}</Text>
        </Box>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryMuted>
          {'Fetch, host, frag'}
        </S.StoryMuted>
      </S.RowCenterBorder>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

        <PageColumn>
        {/* ── Hero band ── */}
        <Box style={{
          borderLeftWidth: 3,
          borderColor: C.accent,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 24,
          paddingBottom: 24,
          gap: 8,
        }}>
          <S.StoryHeadline>
            {'Every network primitive as a one-liner React hook.'}
          </S.StoryHeadline>
          <S.StoryMuted>
            {'Fetch JSON, open WebSockets, host game servers (Valve GoldSrc/Source/Source2 + Minecraft), scrape pages, subscribe to RSS, route through Tor, create encrypted P2P tunnels (userspace or real WireGuard), verify webhooks, and plug into Spotify, GitHub, TMDB, CoinGecko, NASA, and Philips Hue — all from declarative hooks backed by non-blocking Lua I/O.'}
          </S.StoryMuted>
        </Box>

        <Divider />

        {/* ── Band 1: INSTALL — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <S.StoryBody>
              {'Networking spans multiple packages. Core hooks (useFetch, useWebSocket, useScrape) live in @reactjit/core. Server, RSS, and webhooks are separate packages.'}
            </S.StoryBody>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={INSTALL_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 2: FETCH — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={FETCH_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="cloud">{'FETCH'}</SectionLabel>
            <S.StoryBody>
              {'Universal HTTP client. Pass a URL, get typed data back with loading and error states. Pass null to conditionally skip the request. Backed by Lua async HTTP with thread pool workers — never blocks the render loop.'}
            </S.StoryBody>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band 3: WEBSOCKET — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="wifi">{'WEBSOCKET CLIENT'}</SectionLabel>
            <S.StoryBody>
              {'Persistent WebSocket connection with automatic reconnect. The Lua side handles the RFC 6455 handshake, frame parsing, and keepalive. React just sees status, send, and lastMessage. Supports .onion URLs via SOCKS5 tunneling.'}
            </S.StoryBody>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={WEBSOCKET_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 4: PEER SERVER — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={PEER_SERVER_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="wifi">{'PEER SERVER'}</SectionLabel>
            <S.StoryBody>
              {'Host a WebSocket server directly from your React app. Peers connect, you broadcast or send targeted messages. Perfect for local multiplayer, device sync, or P2P tooling. The Lua wsserver handles handshakes and frame masking.'}
            </S.StoryBody>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Callout: Lua I/O ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'All network I/O runs in Lua threads — zero JS overhead. HTTP uses a worker pool (4 threads), WebSockets poll non-blocking sockets each frame, and servers accept connections without blocking the render loop.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 5: GAME SERVER — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="hard-drive">{'GAME SERVER HOSTING'}</SectionLabel>
            <S.StoryBody>
              {'One-liner dedicated game server hosting. Supports Valve engines by generation: GoldSrc (CS 1.6, HL1), Source (CS:S, TF2, GMod, L4D2), Source 2 (CS2, Deadlock), and Minecraft Java Edition. Spawns the server process, generates config files, connects RCON for remote admin, and polls the A2S query protocol for live status.'}
            </S.StoryBody>
            <Box style={{ gap: 3 }}>
              <S.RowG8>
                <S.RowCenterG4>
                  <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.gameserver }} />
                  <Text style={{ color: c.muted, fontSize: 8 }}>{'GoldSrc'}</Text>
                </S.RowCenterG4>
                <S.RowCenterG4>
                  <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent }} />
                  <Text style={{ color: c.muted, fontSize: 8 }}>{'Source'}</Text>
                </S.RowCenterG4>
                <S.RowCenterG4>
                  <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.ws }} />
                  <Text style={{ color: c.muted, fontSize: 8 }}>{'Source 2'}</Text>
                </S.RowCenterG4>
                <S.RowCenterG4>
                  <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.server }} />
                  <Text style={{ color: c.muted, fontSize: 8 }}>{'Minecraft'}</Text>
                </S.RowCenterG4>
              </S.RowG8>
            </Box>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={GAME_SERVER_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 6: GAME SERVER HOOKS — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={GAME_SERVER_HOOKS_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="terminal">{'SERVER MANAGEMENT'}</SectionLabel>
            <S.StoryBody>
              {'useGameServer returns full lifecycle control: start, stop, RCON commands, live player list, and server logs. usePlayerList and useServerStatus are lighter hooks for dashboard UIs that only need a slice. Config can be an inline object, a JSON file path, or a useLocalStore result for persistence across restarts.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Config changes flow through React props. The Lua capability diffs old vs new config and applies changes live via RCON when possible (hostname, password, map), or restarts when necessary (port, tickrate).'}
            </S.StoryCap>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Callout: Game server binary ── */}
        <Box style={{
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          borderLeftWidth: 3,
          borderColor: C.gameserver,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.gameserver} />
          <S.StoryBody>
            {'The GameServer capability manages an existing server binary — it does not include one. You provide the path to srcds, hlds, cs2, or a Minecraft .jar. SteamCMD downloads are handled automatically if steamcmdPath is set. Bundle everything with rjit build linux for a single self-extracting binary: your admin UI + config + server binary.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 7: SCRAPE — demo | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <ScrapeDemo />
          </S.HalfCenter>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="globe">{'WEB SCRAPING'}</SectionLabel>
            <S.StoryBody>
              {'Two modes: expert (provide CSS selectors) or guided (browse an element catalog and pick by ID). Inline HTML parser runs in QuickJS — no DOM needed. Supports attribute extraction, descendant combinators, and auto-refetch intervals.'}
            </S.StoryBody>
            <CodeBlock language="tsx" fontSize={9} code={SCRAPE_CODE} />
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band 6: HTTP SERVER — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={SERVER_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="hard-drive">{'HTTP SERVER'}</SectionLabel>
            <S.StoryBody>
              {'Three hooks, three levels of abstraction. useServer for full control with dynamic routes and static files. useStaticServer for one-liner directory serving. useLibrary for auto-indexed media serving with search, type filtering, and directory stats.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Static routes are handled entirely in Lua — files never cross the bridge. Dynamic route handlers run in React and return response objects.'}
            </S.StoryCap>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band 7: TOR — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="shield">{'TOR NETWORK'}</SectionLabel>
            <S.StoryBody>
              {'Hidden service networking built into the runtime. The Lua side manages the Tor subprocess, generates torrc, polls for the .onion hostname, and provides a SOCKS5 proxy. WebSocket connections to .onion addresses auto-route through the proxy. HTTP requests honor ALL_PROXY for transparent onion routing.'}
            </S.StoryBody>
            <S.StoryCap>
              {'Requires tor binary in PATH or bundled. Hidden service directory lives at ~/.cache/reactjit-tor/.'}
            </S.StoryCap>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={TOR_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Callout: Tor ── */}
        <Box style={{
          backgroundColor: 'rgba(244, 114, 182, 0.08)',
          borderLeftWidth: 3,
          borderColor: C.tor,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="lock" tintColor={C.tor} />
          <S.StoryBody>
            {'SOCKS5 tunneling supports both blocking and async modes with RFC 1928 + RFC 1929 (username/password auth). The async state machine integrates with Love2D\'s frame loop — no threads needed for proxy negotiation.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 8: ENCRYPTED P2P — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="lock">{'ENCRYPTED P2P (USERSPACE)'}</SectionLabel>
            <S.StoryBody>
              {'Encrypted peer-to-peer data channels over UDP. X25519 key agreement + XChaCha20-Poly1305 AEAD — the same crypto primitives WireGuard uses. STUN resolves your public endpoint for NAT traversal. No root, no system deps, works everywhere Love2D runs.'}
            </S.StoryBody>
            <Box style={{ gap: 3 }}>
              <S.RowCenterG6>
                <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.wgUser }} />
                <Text style={{ color: C.wgUser, fontSize: 9, fontWeight: 'bold' }}>{'Tier 2 — Userspace'}</Text>
              </S.RowCenterG6>
              <S.StoryCap>{'Keys in process memory. Protects against network observers, not local attackers.'}</S.StoryCap>
            </Box>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={WG_PEER_TUNNEL_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 9: KERNEL WIREGUARD — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={WG_KERNEL_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="shield">{'WIREGUARD (KERNEL)'}</SectionLabel>
            <S.StoryBody>
              {'Real kernel WireGuard tunnel via the wg CLI. Creates a wg0 interface with OS-level routing. Keys generated by wg genkey go straight from CLI to kernel — never in Lua or JS process memory. Requires wireguard-tools and sudo.'}
            </S.StoryBody>
            <Box style={{ gap: 3 }}>
              <S.RowCenterG6>
                <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.wgKernel }} />
                <Text style={{ color: C.wgKernel, fontSize: 9, fontWeight: 'bold' }}>{'Tier 1 — Kernel'}</Text>
              </S.RowCenterG6>
              <S.StoryCap>{'Kernel trust boundary. Protects against local + network attackers.'}</S.StoryCap>
            </Box>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Callout: WireGuard tiers ── */}
        <Box style={{
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderLeftWidth: 3,
          borderColor: C.wgUser,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="lock" tintColor={C.wgUser} />
          <S.StoryBody>
            {'Both tiers use X25519 keys and the same wire encryption. The difference is where the trust boundary sits. Tier 2 (usePeerTunnel) is zero-config encrypted messaging. Tier 1 (useWireGuard) is a real VPN with kernel isolation. We ship both so you decide — not us. See the WireGuard story for the full threat model comparison.'}
          </S.StoryBody>
        </Box>

        <Divider />

        {/* ── Band 10: RSS — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={RSS_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="globe">{'RSS FEEDS'}</SectionLabel>
            <S.StoryBody>
              {'Subscribe to RSS/Atom feeds with automatic polling, deduplication, and item limiting. useRSSAggregate merges multiple feeds sorted by date. Built-in XML parser works in QuickJS — no DOM or external dependencies.'}
            </S.StoryBody>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band 9: WEBHOOKS — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="lock">{'WEBHOOKS'}</SectionLabel>
            <S.StoryBody>
              {'Receive and send webhooks with HMAC-SHA256 signing and timing-safe verification. useWebhook spins up a listener on a port. sendWebhook fires outbound hooks with automatic signature headers.'}
            </S.StoryBody>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={WEBHOOK_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 10: PROXY — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={PROXY_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="shield">{'PROXY SUPPORT'}</SectionLabel>
            <S.StoryBody>
              {'All HTTP requests honor standard proxy environment variables. HTTP, HTTPS, and SOCKS5 proxies are supported with optional authentication. The Lua HTTP worker handles proxy negotiation in its thread pool — transparent to React.'}
            </S.StoryBody>
          </S.HalfCenter>
        </S.RowCenter>

        {/* ── Callout: API Integrations ── */}
        <Box style={{
          backgroundColor: C.callout,
          borderLeftWidth: 3,
          borderColor: C.calloutBorder,
          paddingLeft: 25,
          paddingRight: 28,
          paddingTop: 14,
          paddingBottom: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
        }}>
          <S.StoryInfoIcon src="info" tintColor={C.calloutBorder} />
          <S.StoryBody>
            {'API integrations are networking hooks with pre-built UI components. Each hook fetches from a public API via useFetch, returns typed data, and has a matching component for one-liner rendering.'}
          </S.StoryBody>
        </Box>

        <Divider />

        <ExternalDependencyNotice
          detail={'The integrations below depend on third-party services, user accounts, local devices, or network reachability. Without those connectors, they are demonstration surfaces only and should not be read as live verification of the remote system path.'}
        />

        <Divider />

        {/* ── Band 11: SPOTIFY / MUSIC — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="music">{'MUSIC — SPOTIFY / LAST.FM'}</SectionLabel>
            <S.StoryBody>
              {'Now-playing, top tracks, and top artists from Spotify or Last.fm. NowPlayingCard shows live progress. TrackRow and ArtistRow for ranked lists with playcount badges. All data comes from one hook call.'}
            </S.StoryBody>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={SPOTIFY_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 12: MEDIA — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={MEDIA_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="film">{'MEDIA — TMDB / TRAKT'}</SectionLabel>
            <S.StoryBody>
              {'Movie and TV lookups via TMDB. MediaPosterCard renders poster art with a score badge and year overlay. Pass posterUrl from tmdbImage() for real artwork, or leave blank for a placeholder.'}
            </S.StoryBody>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band 13: CRYPTO — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="bar-chart-2">{'CRYPTO — COINGECKO'}</SectionLabel>
            <S.StoryBody>
              {'Live coin market data with price, 24h change, and optional sparkline chart. CoinTickerRow renders a compact row with green/red change indicator. Sparkline data comes from CoinGecko\'s 7-day price history.'}
            </S.StoryBody>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={CRYPTO_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 14: GITHUB — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={GITHUB_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="github">{'GITHUB'}</SectionLabel>
            <S.StoryBody>
              {'Profile, repos, stats, and activity feed. GitHubUserCard for the profile header. RepoCard for pinned repos with language dot and star count. StatCard for KPI tiles with trend arrows. ActivityRow for timeline events with colored dots.'}
            </S.StoryBody>
          </S.HalfCenter>
        </S.RowCenter>

        <Divider />

        {/* ── Band 15: NASA — text | code ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 20, gap: 24 }}>
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="star">{'NASA — APOD'}</SectionLabel>
            <S.StoryBody>
              {'Astronomy Picture of the Day. The zero-config <APOD /> component uses a built-in demo key. APODCard renders full-width image with title, date, explanation, and copyright.'}
            </S.StoryBody>
          </S.HalfCenter>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={NASA_CODE} />
        </S.RowCenter>

        <Divider />

        {/* ── Band 16: HUE — code | text ── */}
        <S.RowCenter style={{ paddingLeft: 28, paddingRight: 28, paddingTop: 20, paddingBottom: 24, gap: 24 }}>
          <CodeBlock language="tsx" fontSize={9} style={{ flexGrow: 1, flexBasis: 0 }} code={HUE_CODE} />
          <S.HalfCenter style={{ gap: 8 }}>
            <SectionLabel icon="sun">{'SMART HOME — PHILIPS HUE'}</SectionLabel>
            <S.StoryBody>
              {'Bridge discovery and light control. useHueLights returns live state for all lights with toggle and brightness controls. HueLightBadge shows color, on/off state, and brightness level. Uses hueXYToHex() for CIE color conversion.'}
            </S.StoryBody>
          </S.HalfCenter>
        </S.RowCenter>

        </PageColumn>
      </ScrollView>

      {/* ── Footer ── */}
      <S.RowCenterBorder style={{ flexShrink: 0, backgroundColor: c.bgElevated, borderTopWidth: 1, paddingLeft: 20, paddingRight: 20, paddingTop: 6, paddingBottom: 6, gap: 12 }}>
        <S.DimIcon12 src="folder" />
        <S.StoryCap>{'Packages'}</S.StoryCap>
        <S.StoryCap>{'/'}</S.StoryCap>
        <S.TextIcon12 src="globe" />
        <S.StoryBreadcrumbActive>{'Networking'}</S.StoryBreadcrumbActive>
        <Box style={{ flexGrow: 1 }} />
        <S.StoryCap>{'v0.1.0'}</S.StoryCap>
      </S.RowCenterBorder>

    </S.StoryRoot>
  );
}
