import { useAPI, useAPIMutation, bearer, FetchOptions } from './base';
import { useServiceKey } from './useServiceKey';

export interface GitHubConfig { token?: string; baseURL?: string; }

export function useGitHub(config?: GitHubConfig) {
  const keys = useServiceKey('github');
  const token = config?.token ?? keys.token;
  const base = config?.baseURL ?? 'https://api.github.com';
  const headers = token ? bearer(token) : {};

  const user = () => useAPI<any>(token ? `${base}/user` : null, { headers });
  const repos = (opts?: { per_page?: number; page?: number; sort?: string }) =>
    useAPI<any[]>(token ? `${base}/user/repos?per_page=${opts?.per_page ?? 30}&page=${opts?.page ?? 1}&sort=${opts?.sort ?? 'updated'}` : null, { headers });
  const repo = (owner: string, name: string) =>
    useAPI<any>(owner && name ? `${base}/repos/${owner}/${name}` : null, { headers });
  const issues = (owner: string, name: string, state?: 'open'|'closed'|'all') =>
    useAPI<any[]>(owner && name ? `${base}/repos/${owner}/${name}/issues?state=${state ?? 'open'}` : null, { headers });
  const createIssue = (owner: string, name: string) =>
    useAPIMutation<any>(`${base}/repos/${owner}/${name}/issues`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } });

  return { user, repos, repo, issues, createIssue };
}
