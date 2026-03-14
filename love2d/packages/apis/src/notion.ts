/**
 * Notion API hooks.
 * Auth: Bearer token (internal integration). https://www.notion.so/my-integrations
 */

import { useAPI, useAPIMutation, type APIResult } from './base';

const BASE = 'https://api.notion.com/v1';

// ── Types ───────────────────────────────────────────────

export interface NotionRichText {
  type: 'text';
  text: { content: string; link?: { url: string } | null };
  plain_text: string;
}

export interface NotionPage {
  id: string;
  url: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, any>;
  icon?: { type: string; emoji?: string } | null;
  cover?: { type: string; external?: { url: string } } | null;
}

export interface NotionDatabase {
  id: string;
  title: NotionRichText[];
  description: NotionRichText[];
  url: string;
  properties: Record<string, { id: string; type: string; name: string }>;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: any;
}

export interface NotionPaginated<T> {
  results: T[];
  has_more: boolean;
  next_cursor: string | null;
}

// ── Hooks ───────────────────────────────────────────────

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };
}

export function useNotionDatabases(
  token: string | null,
): APIResult<NotionPaginated<NotionDatabase>> {
  // Search for all databases the integration can access
  const { execute, loading, error, data } = useAPIMutation<NotionPaginated<NotionDatabase>>(
    token ? notionHeaders(token) : undefined,
  );

  // Auto-fetch on mount
  const refetchRef = { current: () => {} };
  if (token && !data && !loading && !error) {
    execute(`${BASE}/search`, { body: { filter: { property: 'object', value: 'database' } } });
  }

  return {
    data,
    loading,
    error,
    refetch: () => execute(`${BASE}/search`, { body: { filter: { property: 'object', value: 'database' } } }),
  };
}

export function useNotionDatabase(
  token: string | null,
  databaseId: string | null,
  opts?: { filter?: any; sorts?: any[] },
): APIResult<NotionPaginated<NotionPage>> {
  const { execute, loading, error, data } = useAPIMutation<NotionPaginated<NotionPage>>(
    token ? notionHeaders(token) : undefined,
  );

  if (token && databaseId && !data && !loading && !error) {
    const body: any = {};
    if (opts?.filter) body.filter = opts.filter;
    if (opts?.sorts) body.sorts = opts.sorts;
    execute(`${BASE}/databases/${databaseId}/query`, { body });
  }

  return {
    data,
    loading,
    error,
    refetch: () => {
      const body: any = {};
      if (opts?.filter) body.filter = opts.filter;
      if (opts?.sorts) body.sorts = opts.sorts;
      return execute(`${BASE}/databases/${databaseId}/query`, { body });
    },
  };
}

export function useNotionPage(
  token: string | null,
  pageId: string | null,
): APIResult<NotionPage> {
  return useAPI(
    token && pageId ? `${BASE}/pages/${pageId}` : null,
    { headers: token ? notionHeaders(token) : undefined },
  );
}

export function useNotionBlocks(
  token: string | null,
  blockId: string | null,
): APIResult<NotionPaginated<NotionBlock>> {
  return useAPI(
    token && blockId ? `${BASE}/blocks/${blockId}/children` : null,
    { headers: token ? notionHeaders(token) : undefined },
  );
}

export function useNotionMutation(token: string | null) {
  const { execute, loading, error } = useAPIMutation(token ? notionHeaders(token) : undefined);
  return {
    createPage: (parentId: string, properties: Record<string, any>, children?: any[]) =>
      execute(`${BASE}/pages`, {
        body: {
          parent: { database_id: parentId },
          properties,
          ...(children ? { children } : {}),
        },
      }),
    updatePage: (pageId: string, properties: Record<string, any>) =>
      execute(`${BASE}/pages/${pageId}`, { method: 'PATCH', body: { properties } }),
    loading,
    error,
  };
}
