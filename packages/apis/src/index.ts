// ── Base Utilities ──────────────────────────────────────
export { useAPI, useAPIMutation, bearer, qs } from './base';
export type { APIResult, APIOptions } from './base';

// ── Service Registry ──────────────────────────────────────
export { builtinServices } from './registry';
export type { ServiceDefinition, ServiceField, ServiceCategory } from './registry';
// Individual service definitions for selective inclusion
export {
  spotify, tmdb, github, weather, homeassistant, lastfm, plex, jellyfin,
  trakt, notion, todoist, ynab, google, hue, nasa, coingecko, steam, telegram,
  polypizza,
  openai, anthropic,
} from './registry';

// ── Settings Menu ─────────────────────────────────────────
export { useSettingsRegistry, resetSettingsRegistry } from './settings';
export { useServiceKey, useServiceKeys } from './useServiceKey';
export type { ServiceKeyResult } from './useServiceKey';

// ── Spotify ────────────────────────────────────────────
export {
  useSpotifyNowPlaying,
  useSpotifyTopTracks,
  useSpotifyTopArtists,
  useSpotifyRecentTracks,
  useSpotifyPlaylists,
  useSpotifySearch,
  useSpotifyPlayback,
} from './spotify';
export type {
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SpotifyImage,
  SpotifyNowPlaying,
  SpotifyPlaylist,
  SpotifyPaginated,
  SpotifyTopItem,
} from './spotify';

// ── TMDB ───────────────────────────────────────────────
export {
  useTMDBTrending,
  useTMDBSearch,
  useTMDBMovie,
  useTMDBSeries,
  useTMDBPopular,
  tmdbImage,
} from './tmdb';
export type {
  TMDBMovie,
  TMDBSeries,
  TMDBPerson,
  TMDBPaginated,
  TMDBMovieDetails,
  TMDBSeriesDetails,
} from './tmdb';

// ── Poly Pizza ─────────────────────────────────────────
export {
  usePolyPizzaModel,
  usePolyPizzaSearch,
  usePolyPizzaModelWithAttribution,
  polyPizzaAttributionFields,
  polyPizzaAttributionLine,
} from './polypizza';
export type {
  PolyPizzaAuthor,
  PolyPizzaLicense,
  PolyPizzaModel,
  PolyPizzaSearchResponse,
  PolyPizzaAttribution,
  PolyPizzaRequestOptions,
  PolyPizzaModelOptions,
  PolyPizzaSearchOptions,
  PolyPizzaModelWithAttributionResult,
} from './polypizza';

// ── GitHub ─────────────────────────────────────────────
export {
  useGitHubUser,
  useGitHubAuthUser,
  useGitHubRepos,
  useGitHubRepo,
  useGitHubIssues,
  useGitHubEvents,
  useGitHubGists,
  useGitHubStarred,
} from './github';
export type {
  GitHubUser,
  GitHubRepo,
  GitHubIssue,
  GitHubEvent,
  GitHubGist,
} from './github';

// ── OpenWeatherMap ─────────────────────────────────────
export {
  useWeatherCurrent,
  useWeatherForecast,
  useGeocode,
  weatherIcon,
} from './weather';
export type {
  WeatherCurrent,
  WeatherCondition,
  WeatherForecast,
  WeatherForecastItem,
  GeoLocation,
} from './weather';

// ── Home Assistant ─────────────────────────────────────
export {
  useHAStates,
  useHAEntity,
  useHAConfig,
  useHAServices,
  useHAHistory,
  useHALogbook,
  useHACallService,
} from './homeassistant';
export type {
  HAState,
  HAService,
  HAConfig,
  HAEvent,
  HALogEntry,
} from './homeassistant';

// ── Last.fm ────────────────────────────────────────────
export {
  useLastFMRecentTracks,
  useLastFMNowPlaying,
  useLastFMTopArtists,
  useLastFMTopTracks,
  useLastFMTopAlbums,
  useLastFMUser,
  lastfmImage,
} from './lastfm';
export type {
  LastFMTrack,
  LastFMArtist,
  LastFMAlbum,
  LastFMUser,
  LastFMImage,
} from './lastfm';

// ── Plex ───────────────────────────────────────────────
export {
  usePlexLibraries,
  usePlexLibrary,
  usePlexRecentlyAdded,
  usePlexSessions,
} from './plex';
export type {
  PlexMediaItem,
  PlexLibrary,
  PlexSession,
} from './plex';

// ── Jellyfin / Emby ───────────────────────────────────
export {
  useJellyfinLibraries,
  useJellyfinItems,
  useJellyfinSessions,
  useJellyfinLatest,
  jellyfinImage,
} from './plex';
export type {
  JellyfinItem,
  JellyfinSession,
  JellyfinLibrary,
} from './plex';

// ── Trakt ──────────────────────────────────────────────
export {
  useTraktWatching,
  useTraktHistory,
  useTraktWatchlist,
  useTraktTrending,
  useTraktStats,
} from './trakt';
export type {
  TraktMovie,
  TraktShow,
  TraktEpisode,
  TraktWatching,
  TraktHistoryItem,
  TraktWatchlistItem,
  TraktStats,
} from './trakt';

// ── Notion ─────────────────────────────────────────────
export {
  useNotionDatabases,
  useNotionDatabase,
  useNotionPage,
  useNotionBlocks,
  useNotionMutation,
} from './notion';
export type {
  NotionPage,
  NotionDatabase,
  NotionBlock,
  NotionRichText,
  NotionPaginated,
} from './notion';

// ── Todoist ────────────────────────────────────────────
export {
  useTodoistTasks,
  useTodoistProjects,
  useTodoistSections,
  useTodoistLabels,
  useTodoistComments,
  useTodoistMutation,
} from './todoist';
export type {
  TodoistTask,
  TodoistProject,
  TodoistSection,
  TodoistLabel,
  TodoistComment,
} from './todoist';

// ── YNAB ───────────────────────────────────────────────
export {
  useYNABBudgets,
  useYNABAccounts,
  useYNABCategories,
  useYNABTransactions,
  useYNABMonths,
  ynabAmount,
} from './ynab';
export type {
  YNABBudget,
  YNABAccount,
  YNABCategory,
  YNABCategoryGroup,
  YNABTransaction,
  YNABMonth,
} from './ynab';

// ── Google Calendar ────────────────────────────────────
export {
  useGoogleCalendars,
  useGoogleCalendarEvents,
  useGoogleCalendarMutation,
} from './google';
export type {
  GoogleCalendar,
  GoogleCalendarEvent,
  GoogleCalendarList,
} from './google';

// ── Google Sheets ──────────────────────────────────────
export {
  useGoogleSheet,
  useGoogleSheetValues,
  useGoogleSheetMutation,
} from './google';
export type {
  GoogleSheet,
  GoogleSheetValues,
} from './google';

// ── Philips Hue ────────────────────────────────────────
export {
  useHueLights,
  useHueLight,
  useHueGroups,
  useHueSensors,
  useHueScenes,
  useHueControl,
  hueXYToHex,
} from './hue';
export type {
  HueLight,
  HueGroup,
  HueSensor,
  HueScene,
} from './hue';

// ── NASA ───────────────────────────────────────────────
export {
  useNASAApod,
  useNASAMarsPhotos,
  useNASANeoFeed,
  useNASAEPIC,
  nasaEPICImageUrl,
} from './nasa';
export type {
  NASAAPOD,
  NASAMarsPhoto,
  NASANeoObject,
  NASANeoFeed,
  NASAEPICImage,
} from './nasa';

// ── CoinGecko ──────────────────────────────────────────
export {
  useCoinPrice,
  useCoinMarkets,
  useCoinDetail,
  useCoinHistory,
  useCoinTrending,
  useCoinGlobal,
} from './coingecko';
export type {
  CoinPrice,
  CoinMarket,
  CoinDetail,
  CoinHistory,
  CoinTrending,
  CoinGlobal,
} from './coingecko';

// ── Steam ──────────────────────────────────────────────
export {
  useSteamUser,
  useSteamOwnedGames,
  useSteamRecentGames,
  useSteamFriends,
  useSteamAchievements,
  useSteamAppDetails,
  steamGameIcon,
  steamHeaderImage,
} from './steam';
export type {
  SteamPlayer,
  SteamOwnedGame,
  SteamRecentGame,
  SteamFriend,
  SteamAchievement,
  SteamAppDetails,
} from './steam';

// ── Telegram ───────────────────────────────────────────
export {
  useTelegramBot,
  useTelegramUpdates,
  useTelegramSend,
} from './telegram';
export type {
  TelegramUser,
  TelegramChat,
  TelegramMessage,
  TelegramUpdate,
  TelegramBotInfo,
} from './telegram';
