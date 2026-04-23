import { useAPI, useAPIMutation, bearer } from './base';
import { useServiceKey } from './useServiceKey';

export interface TodoistConfig { token?: string; }

export function useTodoist(config?: TodoistConfig) {
  const keys = useServiceKey('todoist');
  const token = config?.token ?? keys.token;
  const headers = token ? { ...bearer(token), 'Content-Type': 'application/json' } : {};
  const base = 'https://api.todoist.com/rest/v2';

  const projects = () => useAPI<any[]>(token ? `${base}/projects` : null, { headers });
  const tasks = (projectId?: string) =>
    useAPI<any[]>(token ? `${base}/tasks${projectId ? '?project_id=' + projectId : ''}` : null, { headers });
  const createTask = () =>
    useAPIMutation<any>(`${base}/tasks`, { method: 'POST', headers });
  const completeTask = (id: string) =>
    useAPIMutation<any>(`${base}/tasks/${id}/close`, { method: 'POST', headers });

  return { projects, tasks, createTask, completeTask };
}
