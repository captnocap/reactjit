import { useAPI, qs } from './base';
import { useServiceKey } from './useServiceKey';

export interface NASAConfig { apiKey?: string; }

export function useNASA(config?: NASAConfig) {
  const keys = useServiceKey('nasa');
  const apiKey = config?.apiKey ?? keys.apiKey ?? 'DEMO_KEY';
  const base = 'https://api.nasa.gov';

  const apod = (date?: string) =>
    useAPI<any>(`${base}/planetary/apod?${qs({ api_key: apiKey, date })}`);
  const marsRoverPhotos = (rover: string = 'curiosity', sol?: number) =>
    useAPI<any>(`${base}/mars-photos/api/v1/rovers/${rover}/photos?${qs({ sol: sol ?? 1000, api_key: apiKey })}`);
  const neo = (start?: string, end?: string) =>
    useAPI<any>(`${base}/neo/rest/v1/feed?${qs({ start_date: start, end_date: end, api_key: apiKey })}`);

  return { apod, marsRoverPhotos, neo };
}
