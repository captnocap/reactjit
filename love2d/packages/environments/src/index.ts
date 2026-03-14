// @reactjit/environments — Process environments for ReactJIT
//
// Lua-side: lua/environments.lua (env CRUD, process spawning, package management)
// React-side: hooks for environment lifecycle, process I/O, and env listing

export type {
  EnvType,
  EnvironmentConfig,
  EnvironmentState,
  ProcessConfig,
  ProcessState,
  UseEnvironmentResult,
  UseProcessResult,
  UseEnvironmentsResult,
} from './types';

export {
  useEnvironment,
  useProcess,
  useEnvironments,
  useEnvRun,
} from './hooks';
