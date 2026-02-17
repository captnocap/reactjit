import React, { useState } from 'react';
import { Box, Text, Pressable, ScrollView } from '../../../packages/shared/src';
import { useCoinMarkets, useNASAApod, useCoinPrice, type CoinMarket, type NASAAPOD } from '../../../packages/apis/src';

const BG = '#0f172a';
const CARD = '#1e293b';
const BORDER = '#334155';
const ACCENT = '#60a5fa';
const GREEN = '#22c55e';
const RED = '#ef4444';
const DIM = '#64748b';
const BRIGHT = '#e2e8f0';
const MUTED = '#94a3b8';

// ── API Catalog ────────────────────────────────────────

interface APICatalogEntry {
  name: string;
  hooks: string[];
  auth: string;
  color: string;
}

const CATALOG: APICatalogEntry[] = [
  { name: 'Spotify', hooks: ['useSpotifyNowPlaying', 'useSpotifyTopTracks', 'useSpotifySearch', 'useSpotifyPlayback'], auth: 'OAuth2 Bearer', color: '#1DB954' },
  { name: 'TMDB', hooks: ['useTMDBTrending', 'useTMDBSearch', 'useTMDBMovie', 'useTMDBPopular'], auth: 'API Key', color: '#01D277' },
  { name: 'GitHub', hooks: ['useGitHubUser', 'useGitHubRepos', 'useGitHubIssues', 'useGitHubEvents'], auth: 'Bearer / None', color: '#8b5cf6' },
  { name: 'OpenWeather', hooks: ['useWeatherCurrent', 'useWeatherForecast', 'useGeocode'], auth: 'API Key', color: '#f59e0b' },
  { name: 'Home Assistant', hooks: ['useHAStates', 'useHAEntity', 'useHACallService', 'useHAHistory'], auth: 'Bearer', color: '#03A9F4' },
  { name: 'Last.fm', hooks: ['useLastFMNowPlaying', 'useLastFMTopArtists', 'useLastFMRecentTracks'], auth: 'API Key', color: '#D51007' },
  { name: 'Plex', hooks: ['usePlexLibraries', 'usePlexSessions', 'usePlexRecentlyAdded'], auth: 'X-Plex-Token', color: '#E5A00D' },
  { name: 'Jellyfin', hooks: ['useJellyfinLibraries', 'useJellyfinItems', 'useJellyfinSessions'], auth: 'API Key', color: '#00A4DC' },
  { name: 'Trakt', hooks: ['useTraktWatching', 'useTraktHistory', 'useTraktTrending'], auth: 'Client ID + OAuth', color: '#ED1C24' },
  { name: 'Notion', hooks: ['useNotionDatabases', 'useNotionDatabase', 'useNotionMutation'], auth: 'Bearer', color: '#FFFFFF' },
  { name: 'Todoist', hooks: ['useTodoistTasks', 'useTodoistProjects', 'useTodoistMutation'], auth: 'Bearer', color: '#E44332' },
  { name: 'YNAB', hooks: ['useYNABBudgets', 'useYNABAccounts', 'useYNABTransactions'], auth: 'Bearer', color: '#85C3E9' },
  { name: 'Google Cal', hooks: ['useGoogleCalendarEvents', 'useGoogleCalendars'], auth: 'OAuth2 Bearer', color: '#4285F4' },
  { name: 'Google Sheets', hooks: ['useGoogleSheetValues', 'useGoogleSheetMutation'], auth: 'OAuth2 Bearer', color: '#0F9D58' },
  { name: 'Philips Hue', hooks: ['useHueLights', 'useHueControl', 'useHueScenes'], auth: 'Bridge API Key', color: '#FFB800' },
  { name: 'NASA', hooks: ['useNASAApod', 'useNASAMarsPhotos', 'useNASANeoFeed'], auth: 'API Key / DEMO_KEY', color: '#0B3D91' },
  { name: 'CoinGecko', hooks: ['useCoinPrice', 'useCoinMarkets', 'useCoinHistory'], auth: 'None (free tier)', color: '#8DC647' },
  { name: 'Steam', hooks: ['useSteamUser', 'useSteamOwnedGames', 'useSteamAppDetails'], auth: 'API Key', color: '#1B2838' },
  { name: 'Telegram', hooks: ['useTelegramBot', 'useTelegramUpdates', 'useTelegramSend'], auth: 'Bot Token', color: '#26A5E4' },
];

// ── Live Demo: CoinGecko ───────────────────────────────

function CoinGeckoDemo() {
  const { data, loading, error } = useCoinMarkets({ perPage: 8 });
  const coins = (data ?? []) as CoinMarket[];

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: BORDER }}>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8DC647' }} />
        <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>CoinGecko — Live (no API key)</Text>
      </Box>
      <Text style={{ fontSize: 10, color: DIM }}>useCoinMarkets({'{'} perPage: 8 {'}'})</Text>

      {loading && <Text style={{ fontSize: 11, color: MUTED }}>Loading market data...</Text>}
      {error && <Text style={{ fontSize: 11, color: RED }}>{`Error: ${error.message}`}</Text>}

      {coins.length > 0 && (
        <Box style={{ gap: 4 }}>
          <Box style={{ flexDirection: 'row', width: '100%', gap: 4, paddingBottom: 4 }}>
            <Box style={{ width: 24 }}><Text style={{ fontSize: 9, color: DIM }}>#</Text></Box>
            <Box style={{ width: 80 }}><Text style={{ fontSize: 9, color: DIM }}>Coin</Text></Box>
            <Box style={{ width: 80 }}><Text style={{ fontSize: 9, color: DIM }}>Price</Text></Box>
            <Box style={{ width: 60 }}><Text style={{ fontSize: 9, color: DIM }}>24h</Text></Box>
            <Box style={{ flexGrow: 1 }}><Text style={{ fontSize: 9, color: DIM }}>Market Cap</Text></Box>
          </Box>
          {coins.map((coin) => {
            const change = coin.price_change_percentage_24h ?? 0;
            const changeColor = change >= 0 ? GREEN : RED;
            const changeSign = change >= 0 ? '+' : '';
            return (
              <Box key={coin.id} style={{ flexDirection: 'row', width: '100%', gap: 4, alignItems: 'center' }}>
                <Box style={{ width: 24 }}><Text style={{ fontSize: 10, color: DIM }}>{String(coin.market_cap_rank)}</Text></Box>
                <Box style={{ width: 80 }}>
                  <Text style={{ fontSize: 10, color: BRIGHT }}>{coin.symbol.toUpperCase()}</Text>
                </Box>
                <Box style={{ width: 80 }}>
                  <Text style={{ fontSize: 10, color: BRIGHT }}>
                    {`$${coin.current_price >= 1 ? coin.current_price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : coin.current_price.toFixed(4)}`}
                  </Text>
                </Box>
                <Box style={{ width: 60 }}>
                  <Text style={{ fontSize: 10, color: changeColor }}>
                    {`${changeSign}${change.toFixed(1)}%`}
                  </Text>
                </Box>
                <Box style={{ flexGrow: 1 }}>
                  <Text style={{ fontSize: 10, color: MUTED }}>
                    {`$${(coin.market_cap / 1e9).toFixed(1)}B`}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

// ── Live Demo: NASA APOD ───────────────────────────────

function NASADemo() {
  const { data, loading, error } = useNASAApod(null);
  const apod = data as NASAAPOD | null;

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 12, gap: 8, borderWidth: 1, borderColor: BORDER }}>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#0B3D91' }} />
        <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>NASA APOD — Live (DEMO_KEY)</Text>
      </Box>
      <Text style={{ fontSize: 10, color: DIM }}>useNASAApod(null) // falls back to DEMO_KEY</Text>

      {loading && <Text style={{ fontSize: 11, color: MUTED }}>Loading astronomy picture...</Text>}
      {error && <Text style={{ fontSize: 11, color: RED }}>{`Error: ${error.message}`}</Text>}

      {apod && typeof apod === 'object' && 'title' in apod && (
        <Box style={{ gap: 4 }}>
          <Text style={{ fontSize: 12, color: ACCENT, fontWeight: '700' }}>{apod.title}</Text>
          <Text style={{ fontSize: 10, color: DIM }}>{apod.date}</Text>
          <Text style={{ fontSize: 10, color: MUTED }} numberOfLines={3}>{apod.explanation}</Text>
          {apod.copyright && <Text style={{ fontSize: 9, color: DIM }}>{`(c) ${apod.copyright}`}</Text>}
        </Box>
      )}
    </Box>
  );
}

// ── Live Demo: Bitcoin Price ───────────────────────────

function BitcoinDemo() {
  const { data, loading, error, refetch } = useCoinPrice('bitcoin', { include24hChange: true });

  const btc = data as any;
  const price = btc?.bitcoin?.usd;
  const change = btc?.bitcoin?.usd_24h_change;

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 8, padding: 12, gap: 6, borderWidth: 1, borderColor: BORDER }}>
      <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F7931A' }} />
        <Text style={{ fontSize: 13, color: BRIGHT, fontWeight: '700' }}>One-liner: Bitcoin Price</Text>
      </Box>
      <Text style={{ fontSize: 10, color: DIM }}>useCoinPrice('bitcoin')</Text>
      {loading && <Text style={{ fontSize: 11, color: MUTED }}>Loading...</Text>}
      {error && <Text style={{ fontSize: 11, color: RED }}>{`Error: ${error.message}`}</Text>}
      {price != null && (
        <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ fontSize: 20, color: BRIGHT, fontWeight: '700' }}>
            {`$${Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          </Text>
          {change != null && (
            <Text style={{ fontSize: 12, color: change >= 0 ? GREEN : RED }}>
              {`${change >= 0 ? '+' : ''}${Number(change).toFixed(2)}%`}
            </Text>
          )}
        </Box>
      )}
      <Pressable onPress={refetch} style={{ alignSelf: 'flex-start', backgroundColor: '#334155', paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 4 }}>
        <Text style={{ fontSize: 10, color: ACCENT }}>Refetch</Text>
      </Pressable>
    </Box>
  );
}

// ── API Catalog Grid ───────────────────────────────────

function CatalogCard({ entry }: { entry: APICatalogEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Box style={{ backgroundColor: CARD, borderRadius: 6, padding: 8, gap: 4, borderWidth: 1, borderColor: BORDER, width: 180 }}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: entry.color }} />
          <Text style={{ fontSize: 11, color: BRIGHT, fontWeight: '700' }}>{entry.name}</Text>
        </Box>
      </Pressable>
      <Text style={{ fontSize: 8, color: DIM }}>{entry.auth}</Text>
      {expanded && entry.hooks.map((hook) => (
        <Text key={hook} style={{ fontSize: 9, color: ACCENT }}>{hook}()</Text>
      ))}
      {!expanded && (
        <Text style={{ fontSize: 9, color: MUTED }}>{`${entry.hooks.length} hooks`}</Text>
      )}
    </Box>
  );
}

// ── Main Story ─────────────────────────────────────────

export function APIsStory() {
  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: BG, padding: 16, gap: 12 }}>
      <Box style={{ gap: 2 }}>
        <Text style={{ fontSize: 18, color: BRIGHT, fontWeight: '700' }}>@ilovereact/apis</Text>
        <Text style={{ fontSize: 11, color: DIM }}>18 REST API integrations. One-liner hooks for everything.</Text>
      </Box>

      <Box style={{ flexDirection: 'row', gap: 12, flexGrow: 1 }}>
        {/* Left column: live demos */}
        <Box style={{ flexGrow: 1, gap: 10 }}>
          <BitcoinDemo />
          <CoinGeckoDemo />
          <NASADemo />
        </Box>

        {/* Right column: catalog */}
        <ScrollView style={{ width: 200 }}>
          <Box style={{ gap: 6, paddingRight: 4 }}>
            <Text style={{ fontSize: 11, color: DIM, fontWeight: '700' }}>API Catalog (tap to expand)</Text>
            {CATALOG.map((entry) => (
              <CatalogCard key={entry.name} entry={entry} />
            ))}
          </Box>
        </ScrollView>
      </Box>
    </Box>
  );
}
