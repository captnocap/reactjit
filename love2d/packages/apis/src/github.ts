/**
 * GitHub REST API hooks.
 * Auth: Bearer token (personal access token). https://github.com/settings/tokens
 */

import { useAPI, bearer, qs, type APIResult } from './base';

const BASE = 'https://api.github.com';

// ── Types ───────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  open_issues_count: number;
  topics: string[];
  fork: boolean;
  private: boolean;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: { login: string; avatar_url: string };
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  updated_at: string;
  html_url: string;
  pull_request?: { url: string };
}

export interface GitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload: any;
}

export interface GitHubGist {
  id: string;
  description: string | null;
  html_url: string;
  files: Record<string, { filename: string; language: string; size: number }>;
  created_at: string;
  updated_at: string;
}

// ── Hooks ───────────────────────────────────────────────

function ghHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export function useGitHubUser(
  username: string | null,
  token?: string | null,
): APIResult<GitHubUser> {
  return useAPI(
    username ? `${BASE}/users/${username}` : null,
    { headers: ghHeaders(token) },
  );
}

export function useGitHubAuthUser(
  token: string | null,
): APIResult<GitHubUser> {
  return useAPI(
    token ? `${BASE}/user` : null,
    { headers: ghHeaders(token) },
  );
}

export function useGitHubRepos(
  username: string | null,
  opts?: { sort?: 'updated' | 'stars' | 'pushed'; perPage?: number; token?: string | null },
): APIResult<GitHubRepo[]> {
  return useAPI(
    username ? `${BASE}/users/${username}/repos${qs({ sort: opts?.sort ?? 'updated', per_page: opts?.perPage ?? 30 })}` : null,
    { headers: ghHeaders(opts?.token) },
  );
}

export function useGitHubRepo(
  owner: string | null,
  repo: string | null,
  token?: string | null,
): APIResult<GitHubRepo> {
  return useAPI(
    owner && repo ? `${BASE}/repos/${owner}/${repo}` : null,
    { headers: ghHeaders(token) },
  );
}

export function useGitHubIssues(
  owner: string | null,
  repo: string | null,
  opts?: { state?: 'open' | 'closed' | 'all'; perPage?: number; token?: string | null },
): APIResult<GitHubIssue[]> {
  return useAPI(
    owner && repo
      ? `${BASE}/repos/${owner}/${repo}/issues${qs({ state: opts?.state ?? 'open', per_page: opts?.perPage ?? 30 })}`
      : null,
    { headers: ghHeaders(opts?.token) },
  );
}

export function useGitHubEvents(
  username: string | null,
  opts?: { perPage?: number; token?: string | null },
): APIResult<GitHubEvent[]> {
  return useAPI(
    username ? `${BASE}/users/${username}/events${qs({ per_page: opts?.perPage ?? 30 })}` : null,
    { headers: ghHeaders(opts?.token) },
  );
}

export function useGitHubGists(
  username: string | null,
  token?: string | null,
): APIResult<GitHubGist[]> {
  return useAPI(
    username ? `${BASE}/users/${username}/gists` : null,
    { headers: ghHeaders(token) },
  );
}

export function useGitHubStarred(
  username: string | null,
  opts?: { perPage?: number; token?: string | null },
): APIResult<GitHubRepo[]> {
  return useAPI(
    username ? `${BASE}/users/${username}/starred${qs({ per_page: opts?.perPage ?? 30 })}` : null,
    { headers: ghHeaders(opts?.token) },
  );
}
