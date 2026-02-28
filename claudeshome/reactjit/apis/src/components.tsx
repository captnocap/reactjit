/**
 * @reactjit/apis — Integration components and additional primitives
 *
 * The six core display primitives (NowPlayingCard, MediaPosterCard,
 * CoinTickerRow, StatCard, ActivityRow, HueLightBadge) live in their own
 * files. This file adds:
 *
 *   TrackRow       — ranked track list row (Spotify recent, Last.fm scrobbles)
 *   ArtistRow      — ranked artist row (Last.fm top artists)
 *   RepoCard       — GitHub repo with language dot + star count
 *   GitHubUserCard — user profile (avatar, bio, stats)
 *   APODCard       — NASA APOD full-width image + caption
 *
 * And one-liner integration components that wire hooks → layout:
 *   <SpotifyNowPlaying token="..." />
 *   <SpotifyRecentTracks token="..." />
 *   <LastFMNowPlaying apiKey="..." user="..." />
 *   <LastFMRecentTracks apiKey="..." user="..." />
 *   <LastFMTopArtists apiKey="..." user="..." />
 *   <TMDBTrending apiKey="..." />
 *   <CoinMarkets />                   (no key needed)
 *   <GitHubProfile username="..." />
 *   <GitHubRepos username="..." />
 *   <APOD />                          (uses DEMO_KEY by default)
 */

import React from 'react';
import { Box, Text, Image } from '@reactjit/core';
import { useThemeColors } from '@reactjit/theme';
import type { Style } from '@reactjit/core';

import { NowPlayingCard } from './NowPlayingCard';
import { MediaPosterCard } from './MediaPosterCard';

import { useSpotifyNowPlaying, useSpotifyRecentTracks } from './spotify';
import type { SpotifyTrack } from './spotify';
import { useLastFMNowPlaying, useLastFMRecentTracks, useLastFMTopArtists, lastfmImage } from './lastfm';
import type { LastFMTrack, LastFMArtist } from './lastfm';
import { useTMDBTrending, tmdbImage } from './tmdb';
import type { TMDBMovie } from './tmdb';
import { useCoinMarkets } from './coingecko';
import type { CoinMarket } from './coingecko';
import { useGitHubRepos, useGitHubUser } from './github';
import type { GitHubRepo } from './github';
import { useNASAApod } from './nasa';

import { CoinTickerRow } from './CoinTickerRow';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// Language dot colors follow GitHub conventions — design choice, not a theme token.
const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5', Rust: '#dea584',
  Go: '#00add8', Ruby: '#701516', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600',
  Java: '#b07219', Kotlin: '#a97bff', Swift: '#f05138', Shell: '#89e051', Lua: '#000080',
  HTML: '#e34c26', CSS: '#563d7c', Dart: '#00b4ab', Zig: '#ec915c',
};
function langColor(lang: string | null): string {
  return lang ? (LANG_COLORS[lang] ?? '#8b8b8b') : '#8b8b8b';
}

function Skeleton({ width, height, style }: { width?: number | string; height?: number; style?: Style }) {
  const c = useThemeColors();
  return (
    <Box style={{ width: width ?? '100%', height: height ?? 14, borderRadius: 4, backgroundColor: c.border, ...style }} />
  );
}

// ── TrackRow ──────────────────────────────────────────────────────────────────
// Ranked track list row. Green dot replaces rank number when nowPlaying.

export interface TrackRowProps {
  rank?: number;
  title: string;
  artist: string;
  duration?: string | number; // "3:42" or ms
  art?: string | null;
  nowPlaying?: boolean;
  style?: Style;
}

export function TrackRow({ rank, title, artist, duration, art, nowPlaying = false, style }: TrackRowProps) {
  const c = useThemeColors();
  const durationStr = typeof duration === 'number' ? fmtDuration(duration) : duration;
  return (
    <Box style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, ...style }}>
      {rank !== undefined && !nowPlaying && (
        <Text style={{ fontSize: 11, color: c.muted, width: 20, textAlign: 'right' }}>{rank}</Text>
      )}
      {nowPlaying && rank !== undefined && (
        <Box style={{ width: 20, alignItems: 'center' }}>
          <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
        </Box>
      )}
      {art && (
        <Box style={{ width: 32, height: 32, borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
          <Image src={art} style={{ width: 32, height: 32 }} />
        </Box>
      )}
      <Box style={{ flexGrow: 1, gap: 1 }}>
        <Text style={{ fontSize: 12, color: nowPlaying ? '#22c55e' : c.text }}>{title}</Text>
        <Text style={{ fontSize: 10, color: c.muted }}>{artist}</Text>
      </Box>
      {durationStr && <Text style={{ fontSize: 11, color: c.muted, flexShrink: 0 }}>{durationStr}</Text>}
    </Box>
  );
}

// ── ArtistRow ─────────────────────────────────────────────────────────────────

export interface ArtistRowProps {
  rank?: number;
  name: string;
  imageUrl?: string | null;
  playcount?: string | number;
  style?: Style;
}

export function ArtistRow({ rank, name, imageUrl, playcount, style }: ArtistRowProps) {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, ...style }}>
      {rank !== undefined && (
        <Text style={{ fontSize: 11, color: c.muted, width: 20, textAlign: 'right' }}>{rank}</Text>
      )}
      <Box style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.surface, overflow: 'hidden', flexShrink: 0 }}>
        {imageUrl
          ? <Image src={imageUrl} style={{ width: 36, height: 36 }} />
          : <Box style={{ width: 36, height: 36, backgroundColor: c.border }} />
        }
      </Box>
      <Text style={{ flexGrow: 1, fontSize: 12, color: c.text }}>{name}</Text>
      {playcount !== undefined && (
        <Text style={{ fontSize: 11, color: c.muted }}>{`${fmtCompact(Number(playcount))} plays`}</Text>
      )}
    </Box>
  );
}

// ── RepoCard ──────────────────────────────────────────────────────────────────

export interface RepoCardProps {
  name: string;
  description?: string | null;
  language?: string | null;
  stars: number;
  forks?: number;
  fork?: boolean;
  style?: Style;
}

export function RepoCard({ name, description, language, stars, forks, fork, style }: RepoCardProps) {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 8, padding: 12, backgroundColor: c.surface, borderRadius: 8, borderWidth: 1, borderColor: c.border, ...style }}>
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' }}>
        <Text style={{ flexGrow: 1, fontSize: 13, color: '#3b82f6' }}>{name}</Text>
        {fork && (
          <Box style={{ paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2, borderRadius: 8, borderWidth: 1, borderColor: c.border }}>
            <Text style={{ fontSize: 9, color: c.muted }}>fork</Text>
          </Box>
        )}
      </Box>
      {description && <Text style={{ fontSize: 11, color: c.muted }}>{description}</Text>}
      <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%' }}>
        {language && (
          <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: langColor(language) }} />
            <Text style={{ fontSize: 10, color: c.muted }}>{language}</Text>
          </Box>
        )}
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          {/* Star: rotated square as a diamond */}
          <Box style={{ width: 8, height: 8, borderRadius: 1, backgroundColor: '#f59e0b', transform: [{ rotate: '45deg' }] }} />
          <Text style={{ fontSize: 10, color: c.muted }}>{fmtCompact(stars)}</Text>
        </Box>
        {forks !== undefined && (
          <Text style={{ fontSize: 10, color: c.muted }}>{fmtCompact(forks)} forks</Text>
        )}
      </Box>
    </Box>
  );
}

// ── GitHubUserCard ────────────────────────────────────────────────────────────

export interface GitHubUserCardProps {
  login: string;
  name?: string | null;
  bio?: string | null;
  avatarUrl?: string;
  repos?: number;
  followers?: number;
  following?: number;
  style?: Style;
}

export function GitHubUserCard({ login, name, bio, avatarUrl, repos, followers, following, style }: GitHubUserCardProps) {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', flexDirection: 'row', gap: 12, alignItems: 'center', ...style }}>
      <Box style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: c.surface, flexShrink: 0 }}>
        {avatarUrl
          ? <Image src={avatarUrl} style={{ width: 56, height: 56 }} />
          : <Box style={{ width: 56, height: 56, backgroundColor: c.border }} />
        }
      </Box>
      <Box style={{ flexGrow: 1, gap: 4 }}>
        <Box style={{ gap: 1 }}>
          {name && <Text style={{ fontSize: 14, color: c.text }}>{name}</Text>}
          <Text style={{ fontSize: 11, color: c.muted }}>@{login}</Text>
        </Box>
        {bio && <Text style={{ fontSize: 11, color: c.muted }}>{bio}</Text>}
        <Box style={{ flexDirection: 'row', gap: 14, width: '100%' }}>
          {repos !== undefined && <Text style={{ fontSize: 10, color: c.muted }}>{fmtCompact(repos)} repos</Text>}
          {followers !== undefined && <Text style={{ fontSize: 10, color: c.muted }}>{fmtCompact(followers)} followers</Text>}
          {following !== undefined && <Text style={{ fontSize: 10, color: c.muted }}>{fmtCompact(following)} following</Text>}
        </Box>
      </Box>
    </Box>
  );
}

// ── APODCard ──────────────────────────────────────────────────────────────────

export interface APODCardProps {
  title: string;
  date: string;
  imageUrl: string;
  explanation: string;
  copyright?: string;
  style?: Style;
}

export function APODCard({ title, date, imageUrl, explanation, copyright, style }: APODCardProps) {
  const c = useThemeColors();
  return (
    <Box style={{ width: '100%', gap: 10, ...style }}>
      <Box style={{ width: '100%', height: 240, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface }}>
        <Image src={imageUrl} style={{ width: '100%', height: 240 }} />
      </Box>
      <Box style={{ gap: 4 }}>
        <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
          <Text style={{ flexGrow: 1, fontSize: 14, color: c.text }}>{title}</Text>
          <Text style={{ fontSize: 10, color: c.muted }}>{date}</Text>
        </Box>
        {copyright && <Text style={{ fontSize: 10, color: c.muted }}>{`Photo: ${copyright.trim()}`}</Text>}
        <Text style={{ fontSize: 11, color: c.muted }}>
          {explanation.slice(0, 200)}{explanation.length > 200 ? '...' : ''}
        </Text>
      </Box>
    </Box>
  );
}

// ── One-liner integration components ─────────────────────────────────────────
// Wire hooks → display. React manages state changes and tree re-renders.
// No input processing here.

export interface SpotifyNowPlayingProps {
  token: string | null;
  interval?: number;
  accentColor?: string;
  style?: Style;
}

export function SpotifyNowPlaying({ token, interval = 10000, accentColor = '#1DB954', style }: SpotifyNowPlayingProps) {
  const c = useThemeColors();
  const { data, loading } = useSpotifyNowPlaying(token, { interval });

  if (loading && !data) return (
    <Box style={{ width: '100%', flexDirection: 'row', gap: 10, alignItems: 'center', ...style }}>
      <Skeleton width={56} height={56} style={{ borderRadius: 4 }} />
      <Box style={{ flexGrow: 1, gap: 6 }}>
        <Skeleton width="60%" height={12} />
        <Skeleton width="40%" height={10} />
      </Box>
    </Box>
  );

  if (!data?.item) return (
    <Box style={{ width: '100%', padding: 12, alignItems: 'center', ...style }}>
      <Text style={{ fontSize: 11, color: c.muted }}>Nothing playing</Text>
    </Box>
  );

  const track = data.item;
  const art = track.album.images[0]?.url;
  const progress = data.progress_ms && track.duration_ms
    ? data.progress_ms / track.duration_ms : undefined;

  return (
    <NowPlayingCard
      title={track.name}
      artist={track.artists.map((a) => a.name).join(', ')}
      album={track.album.name}
      art={art}
      playing={data.is_playing}
      progress={progress}
      accentColor={accentColor}
      style={style}
    />
  );
}

export interface SpotifyRecentTracksProps {
  token: string | null;
  limit?: number;
  style?: Style;
}

export function SpotifyRecentTracks({ token, limit = 8, style }: SpotifyRecentTracksProps) {
  const c = useThemeColors();
  const { data, loading } = useSpotifyRecentTracks(token, { limit });
  if (loading && !data) return <Skeleton height={200} style={style} />;
  const items = data?.items ?? [];
  return (
    <Box style={{ width: '100%', gap: 0, ...style }}>
      {items.slice(0, limit).map((item, i) => {
        const t = item.track as SpotifyTrack;
        return (
          <TrackRow key={`${t.id}-${i}`} rank={i + 1} title={t.name}
            artist={t.artists.map((a) => a.name).join(', ')} duration={t.duration_ms}
            art={t.album.images[t.album.images.length - 1]?.url}
            style={{ borderBottomWidth: i < items.length - 1 ? 1 : 0, borderColor: c.border }} />
        );
      })}
      {!items.length && !loading && (
        <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center', padding: 16 }}>No tracks</Text>
      )}
    </Box>
  );
}

export interface LastFMNowPlayingProps {
  apiKey: string | null;
  user: string | null;
  interval?: number;
  style?: Style;
}

export function LastFMNowPlaying({ apiKey, user, interval = 15000, style }: LastFMNowPlayingProps) {
  const c = useThemeColors();
  const { data, loading } = useLastFMNowPlaying(apiKey, user, { interval });
  if (loading && !data) return (
    <Box style={{ width: '100%', flexDirection: 'row', gap: 10, alignItems: 'center', ...style }}>
      <Skeleton width={56} height={56} style={{ borderRadius: 4 }} />
      <Box style={{ flexGrow: 1, gap: 6 }}><Skeleton width="60%" height={12} /><Skeleton width="40%" height={10} /></Box>
    </Box>
  );
  const tracks: LastFMTrack[] = data?.recenttracks?.track ?? [];
  const current = tracks[0];
  if (!current) return (
    <Box style={{ padding: 12, alignItems: 'center', ...style }}>
      <Text style={{ fontSize: 11, color: c.muted }}>No recent tracks</Text>
    </Box>
  );
  const isPlaying = current['@attr']?.nowplaying === 'true';
  const artistName = typeof current.artist === 'object' && 'name' in current.artist
    ? current.artist.name : (current.artist as { '#text': string })['#text'];
  const art = lastfmImage(current.image, 'large') || undefined;
  return (
    <NowPlayingCard title={current.name} artist={artistName} album={current.album?.['#text']}
      art={art} playing={isPlaying} style={style} />
  );
}

export interface LastFMRecentTracksProps {
  apiKey: string | null;
  user: string | null;
  limit?: number;
  interval?: number;
  style?: Style;
}

export function LastFMRecentTracks({ apiKey, user, limit = 8, interval, style }: LastFMRecentTracksProps) {
  const c = useThemeColors();
  const { data, loading } = useLastFMRecentTracks(apiKey, user, { limit, interval });
  if (loading && !data) return <Skeleton height={200} style={style} />;
  const tracks: LastFMTrack[] = data?.recenttracks?.track ?? [];
  return (
    <Box style={{ width: '100%', gap: 0, ...style }}>
      {tracks.slice(0, limit).map((track, i) => {
        const isNow = track['@attr']?.nowplaying === 'true';
        const artistName = typeof track.artist === 'object' && 'name' in track.artist
          ? track.artist.name : (track.artist as { '#text': string })['#text'];
        const art = lastfmImage(track.image, 'small') || null;
        return (
          <TrackRow key={`${track.name}-${i}`} rank={i + 1} title={track.name} artist={artistName}
            art={art} nowPlaying={isNow}
            style={{ borderBottomWidth: i < tracks.length - 1 ? 1 : 0, borderColor: c.border }} />
        );
      })}
      {!tracks.length && !loading && (
        <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center', padding: 16 }}>No tracks</Text>
      )}
    </Box>
  );
}

export interface LastFMTopArtistsProps {
  apiKey: string | null;
  user: string | null;
  limit?: number;
  period?: 'overall' | '7day' | '1month' | '3month' | '6month' | '12month';
  style?: Style;
}

export function LastFMTopArtists({ apiKey, user, limit = 6, period = 'overall', style }: LastFMTopArtistsProps) {
  const c = useThemeColors();
  const { data, loading } = useLastFMTopArtists(apiKey, user, { limit, period });
  if (loading && !data) return <Skeleton height={180} style={style} />;
  const artists: LastFMArtist[] = (data as any)?.topartists?.artist ?? [];
  return (
    <Box style={{ width: '100%', gap: 0, ...style }}>
      {artists.slice(0, limit).map((artist, i) => {
        const img = lastfmImage(artist.image, 'medium') || null;
        return (
          <ArtistRow key={artist.name} rank={i + 1} name={artist.name} imageUrl={img}
            playcount={artist.playcount}
            style={{ borderBottomWidth: i < artists.length - 1 ? 1 : 0, borderColor: c.border }} />
        );
      })}
      {!artists.length && !loading && (
        <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center', padding: 16 }}>No artists</Text>
      )}
    </Box>
  );
}

export interface TMDBTrendingProps {
  apiKey: string | null;
  mediaType?: 'movie' | 'tv' | 'all';
  timeWindow?: 'day' | 'week';
  count?: number;
  style?: Style;
}

export function TMDBTrending({ apiKey, mediaType = 'movie', timeWindow = 'week', count = 6, style }: TMDBTrendingProps) {
  const { data, loading } = useTMDBTrending(apiKey, { mediaType, timeWindow });
  if (loading && !data) return (
    <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', ...style }}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} width={120} height={220} style={{ borderRadius: 6 }} />)}
    </Box>
  );
  const movies: TMDBMovie[] = data?.results?.slice(0, count) ?? [];
  return (
    <Box style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', ...style }}>
      {movies.map((movie) => (
        <MediaPosterCard key={movie.id}
          title={movie.title ?? (movie as any).name}
          posterUrl={movie.poster_path ? tmdbImage(movie.poster_path, 'w185') : undefined}
          year={(movie.release_date ?? (movie as any).first_air_date ?? '').slice(0, 4)}
          score={movie.vote_average} />
      ))}
    </Box>
  );
}

export interface CoinMarketsProps {
  currency?: string;
  count?: number;
  interval?: number;
  style?: Style;
}

export function CoinMarkets({ currency = 'usd', count = 10, interval = 60000, style }: CoinMarketsProps) {
  const c = useThemeColors();
  const { data, loading } = useCoinMarkets({ currency, perPage: count, interval });
  if (loading && !data) return <Skeleton height={300} style={style} />;
  const coins: CoinMarket[] = data ?? [];
  return (
    <Box style={{ width: '100%', gap: 0, ...style }}>
      {coins.map((coin, i) => (
        <CoinTickerRow key={coin.id} symbol={coin.symbol.toUpperCase()} name={coin.name}
          price={coin.current_price} change24h={coin.price_change_percentage_24h}
          sparkline={coin.sparkline_in_7d?.price}
          style={{ borderBottomWidth: i < coins.length - 1 ? 1 : 0, borderColor: c.border, paddingVertical: 8 }} />
      ))}
      {!coins.length && !loading && (
        <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center', padding: 16 }}>No data</Text>
      )}
    </Box>
  );
}

export interface GitHubProfileProps {
  username: string | null;
  token?: string | null;
  style?: Style;
}

export function GitHubProfile({ username, token, style }: GitHubProfileProps) {
  const { data: user, loading } = useGitHubUser(username, token ?? undefined);
  if (loading && !user) return (
    <Box style={{ flexDirection: 'row', gap: 12, alignItems: 'center', ...style }}>
      <Skeleton width={56} height={56} style={{ borderRadius: 28 }} />
      <Box style={{ flexGrow: 1, gap: 6 }}>
        <Skeleton width="50%" height={14} />
        <Skeleton width="30%" height={10} />
        <Skeleton width="70%" height={10} />
      </Box>
    </Box>
  );
  if (!user) return null;
  return (
    <GitHubUserCard login={user.login} name={user.name} bio={user.bio} avatarUrl={user.avatar_url}
      repos={user.public_repos} followers={user.followers} following={user.following} style={style} />
  );
}

export interface GitHubReposProps {
  username: string | null;
  token?: string | null;
  sort?: 'updated' | 'stars' | 'name';
  count?: number;
  style?: Style;
}

export function GitHubRepos({ username, token, sort = 'updated', count = 6, style }: GitHubReposProps) {
  const c = useThemeColors();
  const { data, loading } = useGitHubRepos(username, { token: token ?? undefined, sort });
  if (loading && !data) return <Skeleton height={240} style={style} />;
  const repos: GitHubRepo[] = (data ?? []).slice(0, count);
  return (
    <Box style={{ width: '100%', gap: 8, ...style }}>
      {repos.map((repo) => (
        <RepoCard key={repo.id} name={repo.name} description={repo.description}
          language={repo.language} stars={repo.stargazers_count} forks={repo.forks_count} fork={repo.fork} />
      ))}
      {!repos.length && !loading && (
        <Text style={{ fontSize: 11, color: c.muted, textAlign: 'center', padding: 16 }}>No repos</Text>
      )}
    </Box>
  );
}

export interface APODProps {
  apiKey?: string;
  style?: Style;
}

export function APOD({ apiKey = 'DEMO_KEY', style }: APODProps) {
  const c = useThemeColors();
  const { data, loading } = useNASAApod(apiKey);
  if (loading && !data) return (
    <Box style={{ width: '100%', gap: 10, ...style }}>
      <Skeleton height={240} style={{ borderRadius: 8 }} />
      <Skeleton width="70%" height={14} />
      <Skeleton height={44} />
    </Box>
  );
  if (!data) return null;
  const imageUrl = data.media_type === 'image'
    ? (data.hdurl ?? data.url) : (data.thumbnail_url ?? data.url);
  return (
    <APODCard title={data.title} date={data.date} imageUrl={imageUrl}
      explanation={data.explanation} copyright={data.copyright} style={style} />
  );
}
