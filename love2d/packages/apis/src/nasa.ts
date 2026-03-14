/**
 * NASA Open APIs hooks.
 * Auth: API key as query param. Get one at https://api.nasa.gov
 * DEMO_KEY works for low-rate testing.
 */

import { useAPI, qs, type APIResult } from './base';

const BASE = 'https://api.nasa.gov';

// ── Types ───────────────────────────────────────────────

export interface NASAAPOD {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl?: string;
  media_type: 'image' | 'video';
  copyright?: string;
  thumbnail_url?: string;
}

export interface NASAMarsPhoto {
  id: number;
  sol: number;
  img_src: string;
  earth_date: string;
  camera: { id: number; name: string; full_name: string };
  rover: { id: number; name: string; status: string; landing_date: string; launch_date: string };
}

export interface NASANeoObject {
  id: string;
  name: string;
  nasa_jpl_url: string;
  absolute_magnitude_h: number;
  estimated_diameter: {
    kilometers: { estimated_diameter_min: number; estimated_diameter_max: number };
    meters: { estimated_diameter_min: number; estimated_diameter_max: number };
  };
  is_potentially_hazardous_asteroid: boolean;
  close_approach_data: Array<{
    close_approach_date: string;
    relative_velocity: { kilometers_per_hour: string };
    miss_distance: { kilometers: string; lunar: string };
  }>;
}

export interface NASANeoFeed {
  element_count: number;
  near_earth_objects: Record<string, NASANeoObject[]>;
}

export interface NASAEPICImage {
  identifier: string;
  caption: string;
  image: string;
  date: string;
  coords: { centroid_coordinates: { lat: number; lon: number } };
}

// ── Hooks ───────────────────────────────────────────────

export function useNASAApod(
  apiKey: string | null,
  opts?: { date?: string; count?: number },
): APIResult<NASAAPOD | NASAAPOD[]> {
  const key = apiKey ?? 'DEMO_KEY';
  return useAPI(
    `${BASE}/planetary/apod${qs({ api_key: key, date: opts?.date, count: opts?.count })}`,
  );
}

export function useNASAMarsPhotos(
  apiKey: string | null,
  opts?: { rover?: 'curiosity' | 'opportunity' | 'spirit' | 'perseverance'; sol?: number; earthDate?: string; camera?: string },
): APIResult<{ photos: NASAMarsPhoto[] }> {
  const key = apiKey ?? 'DEMO_KEY';
  const rover = opts?.rover ?? 'curiosity';
  return useAPI(
    `${BASE}/mars-photos/api/v1/rovers/${rover}/photos${qs({
      api_key: key,
      sol: opts?.sol ?? (opts?.earthDate ? undefined : 1000),
      earth_date: opts?.earthDate,
      camera: opts?.camera,
    })}`,
  );
}

export function useNASANeoFeed(
  apiKey: string | null,
  opts?: { startDate?: string; endDate?: string },
): APIResult<NASANeoFeed> {
  const key = apiKey ?? 'DEMO_KEY';
  const startDate = opts?.startDate ?? new Date().toISOString().slice(0, 10);
  return useAPI(
    `${BASE}/neo/rest/v1/feed${qs({ api_key: key, start_date: startDate, end_date: opts?.endDate })}`,
  );
}

export function useNASAEPIC(
  apiKey: string | null,
  opts?: { collection?: 'natural' | 'enhanced'; date?: string },
): APIResult<NASAEPICImage[]> {
  const key = apiKey ?? 'DEMO_KEY';
  const collection = opts?.collection ?? 'natural';
  const datePath = opts?.date ? `/date/${opts.date}` : '';
  return useAPI(
    `https://epic.gsfc.nasa.gov/api/${collection}${datePath}${qs({ api_key: key })}`,
  );
}

/** Build an EPIC image URL from the image data */
export function nasaEPICImageUrl(image: NASAEPICImage, collection: 'natural' | 'enhanced' = 'natural'): string {
  const date = image.date.slice(0, 10).replace(/-/g, '/');
  return `https://epic.gsfc.nasa.gov/archive/${collection}/${date}/png/${image.image}.png`;
}
