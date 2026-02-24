import React, { useState, useEffect } from 'react';
import { Box, Text } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import {
  TrackRow,
  RepoCard,
  ArtistRow,
  APODCard,
  GitHubUserCard,
  NowPlayingCard,
  MediaPosterCard,
  CoinTickerRow,
  StatCard,
  ActivityRow,
  HueLightBadge,
} from '../../../packages/apis/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';

// ── Mock data ─────────────────────────────────────────────────────────────────

const TRACKS = [
  { title: 'Midnight City', artist: 'M83', album: "Hurry Up, We're Dreaming", progress: 0.62 },
  { title: 'Electric Feel', artist: 'MGMT', album: 'Oracular Spectacular', progress: 0.28 },
  { title: 'Time', artist: 'Pink Floyd', album: 'The Dark Side of the Moon', progress: 0.85 },
  { title: 'Blue (Da Ba Dee)', artist: 'Eiffel 65', album: 'Europop', progress: 0.1 },
  { title: 'Around the World', artist: 'Daft Punk', album: 'Homework', progress: 0.5 },
];

const MOVIES = [
  { title: 'Dune: Part Two', rating: 8.3, year: '2024' },
  { title: 'The Bear', rating: 8.7, year: '2022' },
  { title: 'Oppenheimer', rating: 8.3, year: '2023' },
  { title: 'Poor Things', rating: 7.8, year: '2023' },
  { title: 'Saltburn', rating: 7.1, year: '2023' },
];

const REPOS = [
  { name: 'reactjit', description: 'React rendered as raw geometry via LuaJIT + OpenGL', language: 'TypeScript', stars: 1842, forks: 94 },
  { name: 'love2d', description: 'Framework for 2D games in Lua', language: 'C++', stars: 4200, forks: 510 },
  { name: 'quickjs-ng', description: 'QuickJS JavaScript engine, community maintained fork', language: 'C', stars: 2100, forks: 220 },
];

const ARTISTS = [
  { rank: 1, name: 'M83', playcount: '4,210' },
  { rank: 2, name: 'Daft Punk', playcount: '3,880' },
  { rank: 3, name: 'Boards of Canada', playcount: '2,940' },
  { rank: 4, name: 'Aphex Twin', playcount: '2,312' },
  { rank: 5, name: 'Jon Hopkins', playcount: '1,870' },
];

const COINS_BASE = [
  { symbol: 'BTC', name: 'Bitcoin', price: 68420, change24h: 2.41, rank: 1 },
  { symbol: 'ETH', name: 'Ethereum', price: 3810, change24h: -1.73, rank: 2 },
  { symbol: 'SOL', name: 'Solana', price: 182.5, change24h: 5.88, rank: 3 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.1823, change24h: -0.44, rank: 5 },
];

function fakeSpark(seed: number, len = 20): number[] {
  let v = 100 + seed * 10;
  return Array.from({ length: len }, () => {
    v += (Math.random() - 0.48) * 8;
    return Math.max(10, v);
  });
}

const STATS = [
  { label: 'Stars', value: '12.4k', trend: 5.2, accent: '#f59e0b' },
  { label: 'Commits', value: '3,891', trend: 12.1, accent: '#6366f1' },
  { label: 'Issues', value: '47', trend: -8.3, accent: '#ef4444' },
  { label: 'Forks', value: '892', trend: 2.9, accent: '#22c55e' },
];

const EVENTS = [
  { dot: '#6366f1', label: 'Pushed 3 commits to main', time: '2m ago', detail: 'reactjit/core' },
  { dot: '#22c55e', label: 'Opened pull request #147', time: '1h ago', detail: 'feat: add StatCard component' },
  { dot: '#f59e0b', label: 'Released v0.9.2', time: '4h ago', detail: 'reactjit/cli' },
  { dot: '#ec4899', label: 'Starred repository', time: '6h ago', detail: 'awesome-lua/list' },
  { dot: '#06b6d4', label: 'Forked repository', time: '1d ago', detail: 'love2d/love' },
];

const LIGHTS = [
  { name: 'Desk Lamp', on: true, color: '#fbbf24', brightness: 0.85 },
  { name: 'Monitor Bias', on: true, color: '#818cf8', brightness: 0.5 },
  { name: 'Ceiling', on: false, color: '#ffffff', brightness: 0 },
  { name: 'Bedside', on: true, color: '#f97316', brightness: 0.3 },
  { name: 'Kitchen', on: false, color: '#34d399', brightness: 0 },
];

const APOD_MOCK = {
  title: 'The Pillars of Creation',
  date: '2024-10-20',
  imageUrl: 'https://apod.nasa.gov/apod/image/2410/PillarsOfCreation_Webb_1080.jpg',
  explanation: "The Eagle Nebula's Pillars of Creation stretch several light-years into space. Captured by the Webb Space Telescope in near-infrared, dense clouds of interstellar gas and dust are actively forming new stars within the pillars.",
  copyright: 'NASA, ESA, CSA, STScI',
};

// ── Sections ──────────────────────────────────────────────────────────────────

function MusicDemo() {
  const c = useThemeColors();
  const [trackIdx, setTrackIdx] = useState(0);
  const [progress, setProgress] = useState(0.3);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => {
        const next = p + 0.002;
        if (next >= 1) {
          setTrackIdx((i) => (i + 1) % TRACKS.length);
          return 0;
        }
        return next;
      });
    }, 80);
    return () => clearInterval(id);
  }, []);

  const current = TRACKS[trackIdx];

  return (
    <StorySection index={1} title="Music — Spotify / Last.fm">
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>
        NowPlayingCard and NowPlayingCard — use with useSpotifyNowPlaying() or useLastFMNowPlaying().
        TrackRow and ArtistRow for ranked lists.
      </Text>

      <Box style={{ width: '100%', gap: 8 }}>
        <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 9 }}>NowPlayingCard</Text>
          <NowPlayingCard title={current.title} artist={current.artist} album={current.album} playing progress={progress} />
        </Box>

        <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, padding: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 9 }}>NowPlayingCard — accent color, progress bar</Text>
          <NowPlayingCard title={current.title} artist={current.artist} album={current.album} playing progress={progress} accentColor="#1DB954" />
        </Box>

        <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden' }}>
          <Text style={{ color: c.muted, fontSize: 9, padding: 8, paddingBottom: 4 }}>TrackRow</Text>
          {TRACKS.map((t, i) => (
            <TrackRow
              key={t.title}
              rank={i + 1}
              title={t.title}
              artist={t.artist}
              nowPlaying={i === trackIdx}
              style={{ paddingHorizontal: 8, borderBottomWidth: i < TRACKS.length - 1 ? 1 : 0, borderColor: c.border }}
            />
          ))}
        </Box>

        <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden' }}>
          <Text style={{ color: c.muted, fontSize: 9, padding: 8, paddingBottom: 4 }}>ArtistRow</Text>
          {ARTISTS.map((a, i) => (
            <ArtistRow
              key={a.name}
              rank={a.rank}
              name={a.name}
              playcount={a.playcount}
              style={{ paddingHorizontal: 8, borderBottomWidth: i < ARTISTS.length - 1 ? 1 : 0, borderColor: c.border }}
            />
          ))}
        </Box>
      </Box>
    </StorySection>
  );
}

function MediaDemo() {
  const c = useThemeColors();
  return (
    <StorySection index={2} title="Media — TMDB / Trakt / Plex">
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>
        MediaPosterCard and MediaPosterCard for poster grids. Use tmdbImage() for real poster URLs.
      </Text>

      <Text style={{ color: c.muted, fontSize: 9 }}>MediaPosterCard — star rating as Box geometry</Text>
      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
        {MOVIES.map((m) => (
          <MediaPosterCard key={m.title} title={m.title} score={m.rating} year={m.year} width={100} height={150} />
        ))}
      </Box>

      <Text style={{ color: c.muted, fontSize: 9, marginTop: 4 }}>MediaPosterCard — score badge overlay</Text>
      <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
        {MOVIES.map((m) => (
          <MediaPosterCard key={m.title} title={m.title} score={m.rating} year={m.year} width={100} height={150} />
        ))}
      </Box>
    </StorySection>
  );
}

function CoinDemo() {
  const c = useThemeColors();
  const [sparks, setSparks] = useState(() => COINS_BASE.map((_, i) => fakeSpark(i)));

  useEffect(() => {
    const id = setInterval(() => {
      setSparks((prev) =>
        prev.map((spark) => {
          const last = spark[spark.length - 1];
          const next = Math.max(1, last + (Math.random() - 0.49) * last * 0.012);
          return [...spark.slice(1), next];
        }),
      );
    }, 600);
    return () => clearInterval(id);
  }, []);

  return (
    <StorySection index={3} title="Crypto — CoinGecko">
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>
        CoinTickerRow for compact lists, CoinTickerRow adds sparkline. Both use useCoinMarkets() data.
      </Text>

      <Text style={{ color: c.muted, fontSize: 9 }}>CoinTickerRow</Text>
      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden' }}>
        {COINS_BASE.map((coin, i) => (
          <CoinTickerRow
            key={coin.symbol}
            symbol={coin.symbol}
            name={coin.name}
            price={coin.price}
            change24h={coin.change24h}
            style={{ paddingHorizontal: 12, borderBottomWidth: i < COINS_BASE.length - 1 ? 1 : 0, borderColor: c.border }}
          />
        ))}
      </Box>

      <Text style={{ color: c.muted, fontSize: 9, marginTop: 4 }}>CoinTickerRow — live sparkline</Text>
      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, overflow: 'hidden' }}>
        {COINS_BASE.map((coin, i) => (
          <CoinTickerRow
            key={coin.symbol}
            symbol={coin.symbol}
            name={coin.name}
            price={sparks[i][sparks[i].length - 1]}
            change24h={coin.change24h}
            sparkline={sparks[i]}
            style={{ paddingHorizontal: 12, borderBottomWidth: i < COINS_BASE.length - 1 ? 1 : 0, borderColor: c.border }}
          />
        ))}
      </Box>
    </StorySection>
  );
}

function GitHubDemo() {
  const c = useThemeColors();
  return (
    <StorySection index={4} title="GitHub — Profile + Repos + Activity">
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>
        GitHubUserCard, RepoCard, StatCard, ActivityRow. Populate with useGitHubUser() + useGitHubRepos() + useGitHubEvents().
      </Text>

      <GitHubUserCard
        login="siah"
        name="Siah"
        bio="Rendering React as raw geometry. LuaJIT + OpenGL + Love2D."
        repos={42}
        followers={380}
        following={24}
        style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, padding: 12 }}
      />

      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%', justifyContent: 'center' }}>
        {STATS.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            trend={s.trend}
            accent={s.accent}
            style={{ backgroundColor: c.surface, borderRadius: 8, padding: 12, minWidth: 110 }}
          />
        ))}
      </Box>

      <Box style={{ width: '100%', gap: 8 }}>
        {REPOS.map((r) => (
          <RepoCard key={r.name} name={r.name} description={r.description} language={r.language} stars={r.stars} forks={r.forks} />
        ))}
      </Box>

      <Box style={{ width: '100%', backgroundColor: c.surface, borderRadius: 8, padding: 8 }}>
        <Text style={{ color: c.muted, fontSize: 9, marginBottom: 6, paddingLeft: 4, paddingRight: 4 }}>ActivityRow — useGitHubEvents()</Text>
        {EVENTS.map((e, i) => (
          <Box key={e.label}>
            <ActivityRow dot={e.dot} label={e.label} time={e.time} detail={e.detail} style={{ paddingVertical: 6, paddingLeft: 4, paddingRight: 4 }} />
            {i < EVENTS.length - 1 && (
              <Box style={{ paddingLeft: 18 }}>
                <Box style={{ width: 1, height: 6, backgroundColor: c.border, marginLeft: 3 }} />
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </StorySection>
  );
}

function NASADemo() {
  const c = useThemeColors();
  return (
    <StorySection index={5} title="NASA — Astronomy Picture of the Day">
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>
        {`APODCard for full-width media + caption. Use the APOD one-liner for zero-config: <APOD />`}
      </Text>
      <APODCard
        title={APOD_MOCK.title}
        date={APOD_MOCK.date}
        imageUrl={APOD_MOCK.imageUrl}
        explanation={APOD_MOCK.explanation}
        copyright={APOD_MOCK.copyright}
        style={{ width: '100%' }}
      />
    </StorySection>
  );
}

function HueLightsDemo() {
  const c = useThemeColors();
  return (
    <StorySection index={6} title="Smart Home — Philips Hue">
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>
        HueLightBadge shows light color and brightness. Use useHueLights() + hueXYToHex() to populate.
      </Text>
      <Box style={{ width: '100%', gap: 4 }}>
        {LIGHTS.map((l) => (
          <HueLightBadge
            key={l.name}
            name={l.name}
            on={l.on}
            color={l.color}
            brightness={l.brightness}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: l.on ? c.bg : c.bgElevated,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: l.on ? l.color + '40' : c.border,
            }}
          />
        ))}
      </Box>
    </StorySection>
  );
}

export function APIsStory() {
  return (
    <StoryPage>
      <MusicDemo />
      <MediaDemo />
      <CoinDemo />
      <GitHubDemo />
      <NASADemo />
      <HueLightsDemo />
    </StoryPage>
  );
}
