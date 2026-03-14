/**
 * OpenWeatherMap API hooks.
 * Auth: API key as query param. Get one at https://openweathermap.org/api
 */

import { useAPI, qs, type APIResult } from './base';

const BASE = 'https://api.openweathermap.org/data/2.5';
const GEO = 'https://api.openweathermap.org/geo/1.0';

// ── Types ───────────────────────────────────────────────

export interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

export interface WeatherCurrent {
  name: string;
  coord: { lat: number; lon: number };
  weather: WeatherCondition[];
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
    pressure: number;
  };
  wind: { speed: number; deg: number; gust?: number };
  clouds: { all: number };
  visibility: number;
  sys: { sunrise: number; sunset: number; country: string };
  dt: number;
  timezone: number;
}

export interface WeatherForecastItem {
  dt: number;
  main: WeatherCurrent['main'];
  weather: WeatherCondition[];
  wind: WeatherCurrent['wind'];
  clouds: { all: number };
  pop: number;
  dt_txt: string;
}

export interface WeatherForecast {
  list: WeatherForecastItem[];
  city: { name: string; country: string; coord: { lat: number; lon: number } };
}

export interface GeoLocation {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

// ── Hooks ───────────────────────────────────────────────

export function useWeatherCurrent(
  apiKey: string | null,
  opts: { city?: string; lat?: number; lon?: number; units?: 'metric' | 'imperial' },
): APIResult<WeatherCurrent> {
  const params: any = { appid: apiKey, units: opts.units ?? 'metric' };
  if (opts.city) params.q = opts.city;
  else if (opts.lat != null && opts.lon != null) { params.lat = opts.lat; params.lon = opts.lon; }

  return useAPI(
    apiKey && (opts.city || opts.lat != null) ? `${BASE}/weather${qs(params)}` : null,
  );
}

export function useWeatherForecast(
  apiKey: string | null,
  opts: { city?: string; lat?: number; lon?: number; units?: 'metric' | 'imperial' },
): APIResult<WeatherForecast> {
  const params: any = { appid: apiKey, units: opts.units ?? 'metric' };
  if (opts.city) params.q = opts.city;
  else if (opts.lat != null && opts.lon != null) { params.lat = opts.lat; params.lon = opts.lon; }

  return useAPI(
    apiKey && (opts.city || opts.lat != null) ? `${BASE}/forecast${qs(params)}` : null,
  );
}

export function useGeocode(
  apiKey: string | null,
  query: string | null,
  opts?: { limit?: number },
): APIResult<GeoLocation[]> {
  return useAPI(
    apiKey && query ? `${GEO}/direct${qs({ appid: apiKey, q: query, limit: opts?.limit ?? 5 })}` : null,
  );
}

/** Construct an OpenWeatherMap icon URL */
export function weatherIcon(icon: string, size: '1' | '2' | '4' = '2'): string {
  return `https://openweathermap.org/img/wn/${icon}@${size}x.png`;
}
