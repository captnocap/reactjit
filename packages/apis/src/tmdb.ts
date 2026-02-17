/**
 * TMDB (The Movie Database) API hooks.
 * Auth: API key as query param. Get one at https://www.themoviedb.org/settings/api
 */

import { useAPI, qs, type APIResult } from './base';

const BASE = 'https://api.themoviedb.org/3';

// ── Types ───────────────────────────────────────────────

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
}

export interface TMDBSeries {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
}

export interface TMDBPaginated<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TMDBMovieDetails extends TMDBMovie {
  runtime: number;
  budget: number;
  revenue: number;
  tagline: string;
  genres: Array<{ id: number; name: string }>;
  production_companies: Array<{ id: number; name: string; logo_path: string | null }>;
  imdb_id: string | null;
}

export interface TMDBSeriesDetails extends TMDBSeries {
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  genres: Array<{ id: number; name: string }>;
  status: string;
  networks: Array<{ id: number; name: string; logo_path: string | null }>;
}

// ── Hooks ───────────────────────────────────────────────

export function useTMDBTrending(
  apiKey: string | null,
  opts?: { mediaType?: 'movie' | 'tv' | 'all'; timeWindow?: 'day' | 'week' },
): APIResult<TMDBPaginated<TMDBMovie>> {
  const media = opts?.mediaType ?? 'movie';
  const window = opts?.timeWindow ?? 'week';
  return useAPI(
    apiKey ? `${BASE}/trending/${media}/${window}${qs({ api_key: apiKey })}` : null,
  );
}

export function useTMDBSearch(
  apiKey: string | null,
  query: string | null,
  opts?: { type?: 'movie' | 'tv' | 'multi'; page?: number },
): APIResult<TMDBPaginated<TMDBMovie & TMDBSeries>> {
  const type = opts?.type ?? 'multi';
  return useAPI(
    apiKey && query
      ? `${BASE}/search/${type}${qs({ api_key: apiKey, query, page: opts?.page })}`
      : null,
  );
}

export function useTMDBMovie(
  apiKey: string | null,
  movieId: number | null,
): APIResult<TMDBMovieDetails> {
  return useAPI(
    apiKey && movieId ? `${BASE}/movie/${movieId}${qs({ api_key: apiKey })}` : null,
  );
}

export function useTMDBSeries(
  apiKey: string | null,
  seriesId: number | null,
): APIResult<TMDBSeriesDetails> {
  return useAPI(
    apiKey && seriesId ? `${BASE}/tv/${seriesId}${qs({ api_key: apiKey })}` : null,
  );
}

export function useTMDBPopular(
  apiKey: string | null,
  opts?: { type?: 'movie' | 'tv'; page?: number },
): APIResult<TMDBPaginated<TMDBMovie>> {
  const type = opts?.type ?? 'movie';
  return useAPI(
    apiKey ? `${BASE}/${type}/popular${qs({ api_key: apiKey, page: opts?.page })}` : null,
  );
}

/** Construct a full image URL from a TMDB path */
export function tmdbImage(path: string | null, size: string = 'w500'): string | null {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}
