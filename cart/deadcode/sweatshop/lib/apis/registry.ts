export interface ServiceField {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
}

export type ServiceCategory = 'media' | 'dev' | 'ai' | 'smart-home' | 'productivity' | 'finance' | 'social' | 'custom';

export interface ServiceDefinition {
  id: string;
  name: string;
  category: ServiceCategory;
  auth: { type: 'bearer' | 'api-key' | 'header' | 'query' | 'basic' | 'url-path'; fields: ServiceField[] };
  docsUrl?: string;
  baseUrl?: string;
}

export const spotify: ServiceDefinition = {
  id: 'spotify', name: 'Spotify', category: 'media',
  auth: { type: 'bearer', fields: [{ key: 'token', label: 'OAuth2 Token', placeholder: 'Bearer token from OAuth flow' }] },
  docsUrl: 'https://developer.spotify.com/documentation/web-api', baseUrl: 'https://api.spotify.com/v1',
};

export const tmdb: ServiceDefinition = {
  id: 'tmdb', name: 'TMDB', category: 'media',
  auth: { type: 'query', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'v3 API key' }] },
  docsUrl: 'https://developer.themoviedb.org/docs', baseUrl: 'https://api.themoviedb.org/3',
};

export const plex: ServiceDefinition = {
  id: 'plex', name: 'Plex', category: 'media',
  auth: { type: 'header', fields: [
    { key: 'baseUrl', label: 'Server URL', placeholder: 'http://localhost:32400' },
    { key: 'token', label: 'X-Plex-Token', placeholder: 'Plex authentication token' },
  ]},
  docsUrl: 'https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/',
};

export const trakt: ServiceDefinition = {
  id: 'trakt', name: 'Trakt', category: 'media',
  auth: { type: 'header', fields: [
    { key: 'clientId', label: 'Client ID', placeholder: 'Trakt application client ID' },
    { key: 'token', label: 'Access Token (optional)', placeholder: 'OAuth token for user data' },
  ]},
  docsUrl: 'https://trakt.docs.apiary.io/', baseUrl: 'https://api.trakt.tv',
};

export const lastfm: ServiceDefinition = {
  id: 'lastfm', name: 'Last.fm', category: 'media',
  auth: { type: 'query', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'Last.fm API key' }] },
  docsUrl: 'https://www.last.fm/api/account/create', baseUrl: 'https://ws.audioscrobbler.com/2.0/',
};

export const polypizza: ServiceDefinition = {
  id: 'polypizza', name: 'Poly Pizza', category: 'media',
  auth: { type: 'header', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'Poly Pizza API key' }] },
  docsUrl: 'https://support.poly.pizza/en/articles/9799638-poly-pizza-api', baseUrl: 'https://poly.pizza/api/v1.1',
};

export const github: ServiceDefinition = {
  id: 'github', name: 'GitHub', category: 'dev',
  auth: { type: 'bearer', fields: [{ key: 'token', label: 'Personal Access Token', placeholder: 'ghp_...' }] },
  docsUrl: 'https://github.com/settings/tokens', baseUrl: 'https://api.github.com',
};

export const steam: ServiceDefinition = {
  id: 'steam', name: 'Steam', category: 'dev',
  auth: { type: 'query', fields: [{ key: 'apiKey', label: 'Web API Key', placeholder: 'Steam Web API key' }] },
  docsUrl: 'https://steamcommunity.com/dev/apikey', baseUrl: 'https://api.steampowered.com',
};

export const nasa: ServiceDefinition = {
  id: 'nasa', name: 'NASA', category: 'dev',
  auth: { type: 'query', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'DEMO_KEY or api.nasa.gov key' }] },
  docsUrl: 'https://api.nasa.gov/', baseUrl: 'https://api.nasa.gov',
};

export const openai: ServiceDefinition = {
  id: 'openai', name: 'OpenAI', category: 'ai',
  auth: { type: 'bearer', fields: [
    { key: 'apiKey', label: 'API Key', placeholder: 'sk-...' },
    { key: 'baseURL', label: 'Base URL (optional)', placeholder: 'https://api.openai.com' },
  ]},
  docsUrl: 'https://platform.openai.com/api-keys', baseUrl: 'https://api.openai.com',
};

export const anthropic: ServiceDefinition = {
  id: 'anthropic', name: 'Anthropic', category: 'ai',
  auth: { type: 'header', fields: [
    { key: 'apiKey', label: 'API Key', placeholder: 'sk-ant-...' },
    { key: 'baseURL', label: 'Base URL (optional)', placeholder: 'https://api.anthropic.com' },
  ]},
  docsUrl: 'https://console.anthropic.com/settings/keys', baseUrl: 'https://api.anthropic.com',
};

export const homeassistant: ServiceDefinition = {
  id: 'homeassistant', name: 'Home Assistant', category: 'smart-home',
  auth: { type: 'bearer', fields: [
    { key: 'baseUrl', label: 'Server URL', placeholder: 'http://homeassistant.local:8123' },
    { key: 'token', label: 'Long-Lived Access Token', placeholder: 'ey...' },
  ]},
  docsUrl: 'https://www.home-assistant.io/docs/authentication/',
};

export const hue: ServiceDefinition = {
  id: 'hue', name: 'Philips Hue', category: 'smart-home',
  auth: { type: 'url-path', fields: [
    { key: 'bridgeIp', label: 'Bridge IP', placeholder: '192.168.1.x' },
    { key: 'apiKey', label: 'API Key', placeholder: 'Press bridge button then generate' },
  ]},
  docsUrl: 'https://developers.meethue.com/develop/get-started-2/',
};

export const notion: ServiceDefinition = {
  id: 'notion', name: 'Notion', category: 'productivity',
  auth: { type: 'bearer', fields: [{ key: 'token', label: 'Internal Integration Token', placeholder: 'secret_...' }] },
  docsUrl: 'https://www.notion.so/my-integrations', baseUrl: 'https://api.notion.com/v1',
};

export const todoist: ServiceDefinition = {
  id: 'todoist', name: 'Todoist', category: 'productivity',
  auth: { type: 'bearer', fields: [{ key: 'token', label: 'API Token', placeholder: 'Todoist API token' }] },
  docsUrl: 'https://todoist.com/help/articles/find-your-api-token', baseUrl: 'https://api.todoist.com/rest/v2',
};

export const google: ServiceDefinition = {
  id: 'google', name: 'Google', category: 'productivity',
  auth: { type: 'bearer', fields: [{ key: 'token', label: 'OAuth2 Token', placeholder: 'Bearer token from OAuth flow' }] },
  docsUrl: 'https://console.cloud.google.com/apis/credentials', baseUrl: 'https://www.googleapis.com',
};

export const ynab: ServiceDefinition = {
  id: 'ynab', name: 'YNAB', category: 'finance',
  auth: { type: 'bearer', fields: [{ key: 'token', label: 'Personal Access Token', placeholder: 'YNAB API token' }] },
  docsUrl: 'https://api.ynab.com/#personal-access-tokens', baseUrl: 'https://api.ynab.com/v1',
};

export const coingecko: ServiceDefinition = {
  id: 'coingecko', name: 'CoinGecko', category: 'finance',
  auth: { type: 'header', fields: [{ key: 'apiKey', label: 'API Key (optional)', placeholder: 'Free tier works without key' }] },
  docsUrl: 'https://www.coingecko.com/en/api', baseUrl: 'https://api.coingecko.com/api/v3',
};

export const telegram: ServiceDefinition = {
  id: 'telegram', name: 'Telegram Bot', category: 'social',
  auth: { type: 'url-path', fields: [{ key: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF...' }] },
  docsUrl: 'https://core.telegram.org/bots#botfather', baseUrl: 'https://api.telegram.org',
};

export const weather: ServiceDefinition = {
  id: 'weather', name: 'OpenWeatherMap', category: 'social',
  auth: { type: 'query', fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'OpenWeatherMap API key' }] },
  docsUrl: 'https://openweathermap.org/api', baseUrl: 'https://api.openweathermap.org/data/2.5',
};

export const builtinServices: ServiceDefinition[] = [
  openai, anthropic, spotify, tmdb, plex, trakt, lastfm, polypizza,
  github, steam, nasa, homeassistant, hue, notion, todoist, google,
  ynab, coingecko, telegram, weather,
];
