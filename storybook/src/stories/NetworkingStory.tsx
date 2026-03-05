/**
 * Networking — Package documentation page (Layout2 zigzag narrative).
 *
 * Consolidates all networking capabilities: useFetch, useWebSocket,
 * usePeerServer, useScrape, useServer, useRSSFeed, Tor, webhooks.
 * Static hoist ALL code strings and style objects outside the component.
 */

import React, { useState } from 'react';
import { Box, Text, Image, ScrollView, CodeBlock, Pressable, Input } from '../../../packages/core/src';
import { useScrape } from '../../../packages/core/src/useScrape';
import { useThemeColors } from '../../../packages/theme/src';

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
};

// ── Static code blocks (hoisted — never recreated) ──────

const INSTALL_CODE = `import { useFetch, useWebSocket, usePeerServer } from '@reactjit/core'
import { useScrape } from '@reactjit/core'
import { useServer, useStaticServer, useLibrary } from '@reactjit/server'
import { useRSSFeed, useRSSAggregate } from '@reactjit/rss'
import { useWebhook, sendWebhook } from '@reactjit/webhooks'`;

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

// ── Helpers ──────────────────────────────────────────────

function Divider() {
  const c = useThemeColors();
  return <Box style={{ height: 1, flexShrink: 0, backgroundColor: c.border }} />;
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  const c = useThemeColors();
  return (
    <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Image src={icon} style={{ width: 10, height: 10 }} tintColor={C.accent} />
      <Text style={{ color: c.muted, fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>
        {children}
      </Text>
    </Box>
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
      <Box style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
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
      </Box>

      {/* URL bar */}
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
      </Box>

      {/* Selectors being used */}
      <Box style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
        {Object.entries(selectors).map(([k, v]) => (
          <Box key={k} style={{ backgroundColor: C.accentDim, paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 3 }}>
            <Text style={{ fontSize: 8, color: C.accent, fontFamily: 'monospace' }}>{`${k}: '${v}'`}</Text>
          </Box>
        ))}
      </Box>

      {/* Results */}
      {loading ? (
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.rss }} />
          <Text style={{ fontSize: 10, color: C.rss }}>{'Scraping...'}</Text>
        </Box>
      ) : error ? (
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.tor }} />
          <Text style={{ fontSize: 10, color: C.tor }}>{error}</Text>
        </Box>
      ) : data ? (
        <Box style={{ gap: 3 }}>
          {Object.entries(data).map(([key, value]) => {
            const display = value == null ? 'null'
              : Array.isArray(value) ? `[${value.length}] ${value.slice(0, 3).join(' \u2022 ')}${value.length > 3 ? ' ...' : ''}`
              : String(value).length > 120 ? String(value).slice(0, 120) + '\u2026'
              : String(value);
            return (
              <Box key={key} style={{ flexDirection: 'row', gap: 8 }}>
                <Box style={{ width: 70 }}>
                  <Text style={{ color: C.accent, fontSize: 9, fontWeight: 'bold' }}>{key}</Text>
                </Box>
                <Text style={{ color: c.text, fontSize: 9, flexShrink: 1 }}>{display}</Text>
              </Box>
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
    <Box style={{ width: '100%', height: '100%', backgroundColor: c.bg }}>

      {/* ── Header ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderBottomWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 12,
        paddingBottom: 12,
        gap: 14,
      }}>
        <Image src="globe" style={{ width: 18, height: 18 }} tintColor={C.accent} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          {'Networking'}
        </Text>
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
        <Text style={{ color: c.muted, fontSize: 10 }}>
          {'Fetch & send cat pics'}
        </Text>
      </Box>

      {/* ── Center ── */}
      <ScrollView style={{ flexGrow: 1 }}>

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
          <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
            {'Every network primitive as a one-liner React hook.'}
          </Text>
          <Text style={{ color: c.muted, fontSize: 10 }}>
            {'Fetch JSON, open WebSockets, host servers, scrape pages, subscribe to RSS feeds, route through Tor, verify webhooks, and plug into Spotify, GitHub, TMDB, CoinGecko, NASA, and Philips Hue — all from declarative hooks backed by non-blocking Lua I/O. Zero socket code. Zero callback wiring.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 1: INSTALL — text | code ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="download">{'INSTALL'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Networking spans multiple packages. Core hooks (useFetch, useWebSocket, useScrape) live in @reactjit/core. Server, RSS, and webhooks are separate packages.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={INSTALL_CODE} />
        </Box>

        <Divider />

        {/* ── Band 2: FETCH — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={FETCH_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="cloud">{'FETCH'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Universal HTTP client. Pass a URL, get typed data back with loading and error states. Pass null to conditionally skip the request. Backed by Lua async HTTP with thread pool workers — never blocks the render loop.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 3: WEBSOCKET — text | code ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="wifi">{'WEBSOCKET CLIENT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Persistent WebSocket connection with automatic reconnect. The Lua side handles the RFC 6455 handshake, frame parsing, and keepalive. React just sees status, send, and lastMessage. Supports .onion URLs via SOCKS5 tunneling.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={WEBSOCKET_CODE} />
        </Box>

        <Divider />

        {/* ── Band 4: PEER SERVER — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={PEER_SERVER_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="wifi">{'PEER SERVER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Host a WebSocket server directly from your React app. Peers connect, you broadcast or send targeted messages. Perfect for local multiplayer, device sync, or P2P tooling. The Lua wsserver handles handshakes and frame masking.'}
            </Text>
          </Box>
        </Box>

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
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'All network I/O runs in Lua threads — zero JS overhead. HTTP uses a worker pool (4 threads), WebSockets poll non-blocking sockets each frame, and servers accept connections without blocking the render loop.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 5: SCRAPE — demo | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <ScrapeDemo />
          </Box>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="globe">{'WEB SCRAPING'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Two modes: expert (provide CSS selectors) or guided (browse an element catalog and pick by ID). Inline HTML parser runs in QuickJS — no DOM needed. Supports attribute extraction, descendant combinators, and auto-refetch intervals.'}
            </Text>
            <CodeBlock language="tsx" fontSize={9} code={SCRAPE_CODE} />
          </Box>
        </Box>

        <Divider />

        {/* ── Band 6: HTTP SERVER — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={SERVER_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="hard-drive">{'HTTP SERVER'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Three hooks, three levels of abstraction. useServer for full control with dynamic routes and static files. useStaticServer for one-liner directory serving. useLibrary for auto-indexed media serving with search, type filtering, and directory stats.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Static routes are handled entirely in Lua — files never cross the bridge. Dynamic route handlers run in React and return response objects.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 7: TOR — text | code ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="shield">{'TOR NETWORK'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Hidden service networking built into the runtime. The Lua side manages the Tor subprocess, generates torrc, polls for the .onion hostname, and provides a SOCKS5 proxy. WebSocket connections to .onion addresses auto-route through the proxy. HTTP requests honor ALL_PROXY for transparent onion routing.'}
            </Text>
            <Text style={{ color: c.muted, fontSize: 9 }}>
              {'Requires tor binary in PATH or bundled. Hidden service directory lives at ~/.cache/reactjit-tor/.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={TOR_CODE} />
        </Box>

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
          <Image src="lock" style={{ width: 12, height: 12 }} tintColor={C.tor} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'SOCKS5 tunneling supports both blocking and async modes with RFC 1928 + RFC 1929 (username/password auth). The async state machine integrates with Love2D\'s frame loop — no threads needed for proxy negotiation.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 8: RSS — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={RSS_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="globe">{'RSS FEEDS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Subscribe to RSS/Atom feeds with automatic polling, deduplication, and item limiting. useRSSAggregate merges multiple feeds sorted by date. Built-in XML parser works in QuickJS — no DOM or external dependencies.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 9: WEBHOOKS — text | code ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="lock">{'WEBHOOKS'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Receive and send webhooks with HMAC-SHA256 signing and timing-safe verification. useWebhook spins up a listener on a port. sendWebhook fires outbound hooks with automatic signature headers.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={WEBHOOK_CODE} />
        </Box>

        <Divider />

        {/* ── Band 10: PROXY — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={PROXY_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="shield">{'PROXY SUPPORT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'All HTTP requests honor standard proxy environment variables. HTTP, HTTPS, and SOCKS5 proxies are supported with optional authentication. The Lua HTTP worker handles proxy negotiation in its thread pool — transparent to React.'}
            </Text>
          </Box>
        </Box>

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
          <Image src="info" style={{ width: 12, height: 12 }} tintColor={C.calloutBorder} />
          <Text style={{ color: c.text, fontSize: 10 }}>
            {'API integrations are networking hooks with pre-built UI components. Each hook fetches from a public API via useFetch, returns typed data, and has a matching component for one-liner rendering.'}
          </Text>
        </Box>

        <Divider />

        {/* ── Band 11: SPOTIFY / MUSIC — text | code ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="music">{'MUSIC — SPOTIFY / LAST.FM'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Now-playing, top tracks, and top artists from Spotify or Last.fm. NowPlayingCard shows live progress. TrackRow and ArtistRow for ranked lists with playcount badges. All data comes from one hook call.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={SPOTIFY_CODE} />
        </Box>

        <Divider />

        {/* ── Band 12: MEDIA — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={MEDIA_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="film">{'MEDIA — TMDB / TRAKT'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Movie and TV lookups via TMDB. MediaPosterCard renders poster art with a score badge and year overlay. Pass posterUrl from tmdbImage() for real artwork, or leave blank for a placeholder.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 13: CRYPTO — text | code ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="bar-chart-2">{'CRYPTO — COINGECKO'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Live coin market data with price, 24h change, and optional sparkline chart. CoinTickerRow renders a compact row with green/red change indicator. Sparkline data comes from CoinGecko\'s 7-day price history.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={CRYPTO_CODE} />
        </Box>

        <Divider />

        {/* ── Band 14: GITHUB — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={GITHUB_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="github">{'GITHUB'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Profile, repos, stats, and activity feed. GitHubUserCard for the profile header. RepoCard for pinned repos with language dot and star count. StatCard for KPI tiles with trend arrows. ActivityRow for timeline events with colored dots.'}
            </Text>
          </Box>
        </Box>

        <Divider />

        {/* ── Band 15: NASA — text | code ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 20,
          gap: 24,
          alignItems: 'center',
        }}>
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="star">{'NASA — APOD'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Astronomy Picture of the Day. The zero-config <APOD /> component uses a built-in demo key. APODCard renders full-width image with title, date, explanation, and copyright.'}
            </Text>
          </Box>
          <CodeBlock language="tsx" fontSize={9} code={NASA_CODE} />
        </Box>

        <Divider />

        {/* ── Band 16: HUE — code | text ── */}
        <Box style={{
          flexDirection: 'row',
          paddingLeft: 28,
          paddingRight: 28,
          paddingTop: 20,
          paddingBottom: 24,
          gap: 24,
          alignItems: 'center',
        }}>
          <CodeBlock language="tsx" fontSize={9} code={HUE_CODE} />
          <Box style={{ flexGrow: 1, flexBasis: 0, gap: 8, justifyContent: 'center' }}>
            <SectionLabel icon="sun">{'SMART HOME — PHILIPS HUE'}</SectionLabel>
            <Text style={{ color: c.text, fontSize: 10 }}>
              {'Bridge discovery and light control. useHueLights returns live state for all lights with toggle and brightness controls. HueLightBadge shows color, on/off state, and brightness level. Uses hueXYToHex() for CIE color conversion.'}
            </Text>
          </Box>
        </Box>

      </ScrollView>

      {/* ── Footer ── */}
      <Box style={{
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderTopWidth: 1,
        borderColor: c.border,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 6,
        paddingBottom: 6,
        gap: 12,
      }}>
        <Image src="folder" style={{ width: 12, height: 12 }} tintColor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'Packages'}</Text>
        <Text style={{ color: c.muted, fontSize: 9 }}>{'/'}</Text>
        <Image src="globe" style={{ width: 12, height: 12 }} tintColor={c.text} />
        <Text style={{ color: c.text, fontSize: 9 }}>{'Networking'}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text style={{ color: c.muted, fontSize: 9 }}>{'v0.1.0'}</Text>
      </Box>

    </Box>
  );
}
