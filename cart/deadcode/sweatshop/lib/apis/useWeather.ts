import { useAPI, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface WeatherConfig { apiKey?: string; units?: 'metric'|'imperial'|'standard'; }

export function useWeather(config?: WeatherConfig) {
  const keys = useServiceKey('weather');
  const apiKey = config?.apiKey ?? keys.apiKey;
  const units = config?.units ?? 'metric';
  const base = 'https://api.openweathermap.org/data/2.5';

  const current = (lat: number, lon: number) =>
    useAPI<any>(apiKey ? `${base}/weather?${qs({ lat, lon, units, appid: apiKey })}` : null);
  const forecast = (lat: number, lon: number) =>
    useAPI<any>(apiKey ? `${base}/forecast?${qs({ lat, lon, units, appid: apiKey })}` : null);
  const byCity = (city: string) =>
    useAPI<any>(apiKey && city ? `${base}/weather?${qs({ q: city, units, appid: apiKey })}` : null);

  return { current, forecast, byCity };
}
