import { useMemo } from 'react';
import { useAPI, qs, useServiceKey } from '../../../lib/apis';
import type { WeatherLocation } from './useLocation';

type GeoLocation = {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
};

export function useWeather(location: WeatherLocation) {
  const keys = useServiceKey('weather');
  const apiKey = (keys.apiKey || '').trim();
  const hasKey = !!apiKey;

  const geoUrl = useMemo(() => {
    if (!hasKey || !location.city) return null;
    return `https://api.openweathermap.org/geo/1.0/direct${qs({ appid: apiKey, q: location.city, limit: 5 })}`;
  }, [apiKey, hasKey, location.city]);

  const resolved = useAPI<GeoLocation[]>(geoUrl);
  const resolvedLocation = useMemo(() => {
    if (location.lat != null && location.lon != null) return { lat: location.lat, lon: location.lon };
    const first = resolved.data?.[0];
    return first ? { lat: first.lat, lon: first.lon } : null;
  }, [location.lat, location.lon, resolved.data]);

  const weatherUrl = useMemo(() => {
    if (!hasKey) return null;
    const params: Record<string, string | number | undefined> = { appid: apiKey, units: location.units };
    if (resolvedLocation) { params.lat = resolvedLocation.lat; params.lon = resolvedLocation.lon; }
    else if (location.city) { params.q = location.city; }
    else return null;
    return `https://api.openweathermap.org/data/2.5/weather${qs(params)}`;
  }, [apiKey, hasKey, location.city, location.units, resolvedLocation?.lat, resolvedLocation?.lon]);

  const forecastUrl = useMemo(() => {
    if (!hasKey) return null;
    const params: Record<string, string | number | undefined> = { appid: apiKey, units: location.units };
    if (resolvedLocation) { params.lat = resolvedLocation.lat; params.lon = resolvedLocation.lon; }
    else if (location.city) { params.q = location.city; }
    else return null;
    return `https://api.openweathermap.org/data/2.5/forecast${qs(params)}`;
  }, [apiKey, hasKey, location.city, location.units, resolvedLocation?.lat, resolvedLocation?.lon]);

  const current = useAPI<any>(weatherUrl);
  const forecast = useAPI<any>(forecastUrl);

  const banner = !hasKey
    ? 'set weather API key in Settings > APIs'
    : current.error?.message || forecast.error?.message || resolved.error?.message || '';

  return { apiKey, hasKey, banner, current, forecast, geocode: resolved };
}
