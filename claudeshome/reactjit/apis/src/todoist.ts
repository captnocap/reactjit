/**
 * Todoist REST API hooks.
 * Auth: Bearer token. Settings > Integrations > Developer.
 */

import { useAPI, useAPIMutation, bearer, qs, type APIResult } from './base';

const BASE = 'https://api.todoist.com/rest/v2';

// ── Types ───────────────────────────────────────────────

export interface TodoistTask {
  id: string;
  content: string;
  description: string;
  is_completed: boolean;
  priority: 1 | 2 | 3 | 4;
  due?: { date: string; string: string; datetime?: string; recurring: boolean } | null;
  labels: string[];
  project_id: string;
  section_id?: string;
  parent_id?: string | null;
  order: number;
  created_at: string;
  url: string;
}

export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
  is_inbox_project: boolean;
  comment_count: number;
  url: string;
}

export interface TodoistSection {
  id: string;
  name: string;
  project_id: string;
  order: number;
}

export interface TodoistLabel {
  id: string;
  name: string;
  color: string;
  order: number;
  is_favorite: boolean;
}

export interface TodoistComment {
  id: string;
  content: string;
  posted_at: string;
  task_id?: string;
  project_id?: string;
}

// ── Hooks ───────────────────────────────────────────────

export function useTodoistTasks(
  token: string | null,
  opts?: { projectId?: string; label?: string; filter?: string },
): APIResult<TodoistTask[]> {
  return useAPI(
    token ? `${BASE}/tasks${qs({ project_id: opts?.projectId, label: opts?.label, filter: opts?.filter })}` : null,
    { headers: bearer(token!) },
  );
}

export function useTodoistProjects(
  token: string | null,
): APIResult<TodoistProject[]> {
  return useAPI(
    token ? `${BASE}/projects` : null,
    { headers: bearer(token!) },
  );
}

export function useTodoistSections(
  token: string | null,
  projectId: string | null,
): APIResult<TodoistSection[]> {
  return useAPI(
    token && projectId ? `${BASE}/sections${qs({ project_id: projectId })}` : null,
    { headers: bearer(token!) },
  );
}

export function useTodoistLabels(
  token: string | null,
): APIResult<TodoistLabel[]> {
  return useAPI(
    token ? `${BASE}/labels` : null,
    { headers: bearer(token!) },
  );
}

export function useTodoistComments(
  token: string | null,
  opts: { taskId?: string; projectId?: string },
): APIResult<TodoistComment[]> {
  return useAPI(
    token && (opts.taskId || opts.projectId)
      ? `${BASE}/comments${qs({ task_id: opts.taskId, project_id: opts.projectId })}`
      : null,
    { headers: bearer(token!) },
  );
}

export function useTodoistMutation(token: string | null) {
  const { execute, loading, error } = useAPIMutation(token ? bearer(token) : undefined);
  return {
    createTask: (content: string, opts?: { projectId?: string; priority?: number; dueString?: string; labels?: string[] }) =>
      execute(`${BASE}/tasks`, {
        body: {
          content,
          project_id: opts?.projectId,
          priority: opts?.priority,
          due_string: opts?.dueString,
          labels: opts?.labels,
        },
      }),
    completeTask: (taskId: string) =>
      execute(`${BASE}/tasks/${taskId}/close`),
    reopenTask: (taskId: string) =>
      execute(`${BASE}/tasks/${taskId}/reopen`),
    deleteTask: (taskId: string) =>
      execute(`${BASE}/tasks/${taskId}`, { method: 'DELETE' }),
    updateTask: (taskId: string, updates: Partial<Pick<TodoistTask, 'content' | 'description' | 'priority' | 'labels'>>) =>
      execute(`${BASE}/tasks/${taskId}`, { method: 'POST', body: updates }),
    loading,
    error,
  };
}
