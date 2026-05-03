// Worker — the runtime actor. One row per active or recently-active
// agent in the cockpit. Pared down from the datashapes.md `Agent`
// shape: we deliberately skip trust scores, self-modification policy,
// and the autonomous delegation chain — those are enterprise-scale
// governance features that don't apply to a single-user tool yet.
//
// Today's WorkerState (cart/cockpit) carries most of this inline. This
// shape promotes worker identity to first class so that:
//   - WorkerEvent.requestId → InferenceRequest → Worker becomes a real
//     chain, not an implicit "everything belongs to a session."
//   - RoleAssignment.scope='worker' has a stable target.
//   - Parent / child worker relationships are tracked explicitly (the
//     supervisor + worker pattern the repo already uses).

import type { GalleryDataReference, JsonObject } from '../types';

export type WorkerLifecycle =
  | 'spawning'
  | 'active'
  | 'idle'
  | 'streaming'
  | 'suspended'
  | 'terminating'
  | 'terminated'
  | 'crashed';

export type WorkerKind = 'primary' | 'subagent' | 'supervisor' | 'background';

export type Worker = {
  id: string;
  userId: string;
  workspaceId: string;
  projectId?: string;
  environmentId?: string;
  settingsId: string;
  sessionId?: string; // current WorkerSession, if running
  label: string;
  kind: WorkerKind;
  lifecycle: WorkerLifecycle;
  roleId?: string;
  connectionId: string;
  modelId: string;
  parentWorkerId?: string; // supervisor chain
  childWorkerIds?: string[];
  maxConcurrentRequests: number;
  spawnedAt: string;
  lastActivityAt?: string;
  terminatedAt?: string;
};

export const workerMockData: Worker[] = [
  {
    id: 'worker_sup_01',
    userId: 'user_local',
    workspaceId: 'ws_reactjit',
    projectId: 'proj_reactjit_carts',
    environmentId: 'env_reactjit_local',
    settingsId: 'settings_default',
    sessionId: 'sess_claude_01',
    label: 'Supervisor',
    kind: 'supervisor',
    lifecycle: 'active',
    roleId: 'role_planner',
    connectionId: 'conn_claude_cli',
    modelId: 'claude-opus-4-7',
    childWorkerIds: ['w1', 'worker_sub_02'],
    maxConcurrentRequests: 1,
    spawnedAt: '2026-04-24T08:58:00Z',
    lastActivityAt: '2026-04-24T09:02:14Z',
  },
  {
    id: 'w1',
    userId: 'user_local',
    workspaceId: 'ws_reactjit',
    projectId: 'proj_reactjit_carts',
    environmentId: 'env_reactjit_local',
    settingsId: 'settings_default',
    sessionId: 'sess_claude_01',
    label: 'Worker 1 — documentarian',
    kind: 'primary',
    lifecycle: 'streaming',
    roleId: 'role_documentarian',
    connectionId: 'conn_claude_cli',
    modelId: 'claude-sonnet-4-6',
    parentWorkerId: 'worker_sup_01',
    maxConcurrentRequests: 1,
    spawnedAt: '2026-04-24T09:10:00Z',
    lastActivityAt: '2026-04-24T09:10:42Z',
  },
  {
    id: 'worker_sub_02',
    userId: 'user_local',
    workspaceId: 'ws_reactjit',
    projectId: 'proj_reactjit_framework',
    environmentId: 'env_reactjit_local',
    settingsId: 'settings_default',
    sessionId: 'sess_kimi_01',
    label: 'Worker 2 — triage',
    kind: 'subagent',
    lifecycle: 'idle',
    roleId: 'role_reviewer',
    connectionId: 'conn_kimi',
    modelId: 'kimi-k2',
    parentWorkerId: 'worker_sup_01',
    maxConcurrentRequests: 1,
    spawnedAt: '2026-04-24T09:05:00Z',
    lastActivityAt: '2026-04-24T09:06:03Z',
  },
  {
    id: 'worker_strict_reviewer',
    userId: 'user_local',
    workspaceId: 'ws_client_project',
    projectId: 'proj_client_engagement',
    environmentId: 'env_client_staging',
    settingsId: 'settings_work_strict',
    label: 'Client reviewer',
    kind: 'primary',
    lifecycle: 'idle',
    roleId: 'role_reviewer_strict',
    connectionId: 'conn_anthropic_api',
    modelId: 'claude-sonnet-4-6',
    maxConcurrentRequests: 1,
    spawnedAt: '2026-04-12T14:00:00Z',
    lastActivityAt: '2026-04-12T14:22:00Z',
  },
];

export const workerSchema: JsonObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Worker',
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'userId',
      'workspaceId',
      'settingsId',
      'label',
      'kind',
      'lifecycle',
      'connectionId',
      'modelId',
      'maxConcurrentRequests',
      'spawnedAt',
    ],
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      workspaceId: { type: 'string' },
      projectId: { type: 'string' },
      environmentId: { type: 'string' },
      settingsId: { type: 'string' },
      sessionId: { type: 'string' },
      label: { type: 'string' },
      kind: { type: 'string', enum: ['primary', 'subagent', 'supervisor', 'background'] },
      lifecycle: {
        type: 'string',
        enum: [
          'spawning',
          'active',
          'idle',
          'streaming',
          'suspended',
          'terminating',
          'terminated',
          'crashed',
        ],
      },
      roleId: { type: 'string' },
      connectionId: { type: 'string' },
      modelId: { type: 'string' },
      parentWorkerId: { type: 'string' },
      childWorkerIds: { type: 'array', items: { type: 'string' } },
      maxConcurrentRequests: { type: 'number' },
      spawnedAt: { type: 'string' },
      lastActivityAt: { type: 'string' },
      terminatedAt: { type: 'string' },
    },
  },
};

export const workerReferences: GalleryDataReference[] = [
  { kind: 'belongs-to', label: 'User', targetSource: 'cart/component-gallery/data/user.ts', sourceField: 'userId', targetField: 'id' },
  {
    kind: 'belongs-to',
    label: 'Workspace',
    targetSource: 'cart/component-gallery/data/workspace.ts',
    sourceField: 'workspaceId',
    targetField: 'id',
  },
  {
    kind: 'belongs-to',
    label: 'Settings',
    targetSource: 'cart/component-gallery/data/settings.ts',
    sourceField: 'settingsId',
    targetField: 'id',
  },
  {
    kind: 'references',
    label: 'Project',
    targetSource: 'cart/component-gallery/data/project.ts',
    sourceField: 'projectId',
    targetField: 'id',
  },
  {
    kind: 'references',
    label: 'Environment',
    targetSource: 'cart/component-gallery/data/environment.ts',
    sourceField: 'environmentId',
    targetField: 'id',
  },
  {
    kind: 'references',
    label: 'Role',
    targetSource: 'cart/component-gallery/data/role.ts',
    sourceField: 'roleId',
    targetField: 'id',
  },
  {
    kind: 'references',
    label: 'Connection',
    targetSource: 'cart/component-gallery/data/connection.ts',
    sourceField: 'connectionId',
    targetField: 'id',
  },
  {
    kind: 'references',
    label: 'Model',
    targetSource: 'cart/component-gallery/data/model.ts',
    sourceField: 'modelId',
    targetField: 'id',
  },
  {
    kind: 'references',
    label: 'Current session',
    targetSource: 'cart/component-gallery/data/worker-session.ts',
    sourceField: 'sessionId',
    targetField: 'id',
  },
  {
    kind: 'references',
    label: 'Parent worker',
    targetSource: 'cart/component-gallery/data/worker.ts',
    sourceField: 'parentWorkerId',
    targetField: 'id',
    summary: 'Supervisor → child chain. A supervisor row lists its children in childWorkerIds for symmetry.',
  },
  {
    kind: 'has-many',
    label: 'Inference requests',
    targetSource: 'cart/component-gallery/data/inference-request.ts',
    sourceField: 'id',
    targetField: 'workerId (to wire)',
    summary:
      'Inference requests should carry a workerId so "what has this worker been up to" is a direct query, not a session-join.',
  },
];
