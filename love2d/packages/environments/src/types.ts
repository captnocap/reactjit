// ============================================================================
// Environment types
// ============================================================================

export type EnvType = 'python' | 'node' | 'conda' | 'rust' | 'docker' | 'custom';

export interface EnvironmentConfig {
  /** Unique name for this environment. */
  name: string;
  /** Runtime type. Determines activation strategy. */
  type: EnvType;
  /** Packages to install (pip packages, npm packages, cargo crates, etc.). */
  packages?: string[];
  /** Working directory for all processes in this env. */
  cwd?: string;
  /** Environment variable overrides. Set false to unset a var. */
  env?: Record<string, string | false>;
  /** Custom shell setup commands (sourced before every process). */
  setup?: string[];

  // ── Type-specific options ──────────────────────────────────────────────

  /** Python version constraint (e.g. "3.11", "3.12"). Default: system python3. */
  python?: string;
  /** Node version (e.g. "20", "22"). Only for type: 'node'. */
  node?: string;
  /** Conda environment name (defaults to env name). Only for type: 'conda'. */
  condaEnv?: string;
  /** Docker image. Only for type: 'docker'. */
  image?: string;
  /** Docker run flags (e.g. ["--gpus", "all"]). Only for type: 'docker'. */
  dockerFlags?: string[];
  /** Package manager override: 'pip' | 'npm' | 'yarn' | 'pnpm' | 'cargo' | 'conda'. Auto-detected from type if omitted. */
  packageManager?: string;
}

export interface EnvironmentState {
  /** The config this env was created from. */
  config: EnvironmentConfig;
  /** True once the env has been created on disk (venv exists, packages installed). */
  ready: boolean;
  /** True while the env is being set up (creating venv, installing packages). */
  installing: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** Installed packages (populated after env:get). */
  installedPackages: string[];
  /** Absolute path to the environment root (venv dir, node_modules parent, etc.). */
  path: string | null;
}

// ============================================================================
// Process types
// ============================================================================

export interface ProcessConfig {
  /** Command to run inside the environment. */
  command: string;
  /** Override working directory for this specific process. */
  cwd?: string;
  /** Extra env vars for this process (merged with environment's env). */
  env?: Record<string, string | false>;
  /** Use a PTY (real terminal) instead of pipes. Default: true. */
  pty?: boolean;
  /** PTY rows. Default: 24. */
  rows?: number;
  /** PTY cols. Default: 80. */
  cols?: number;
}

export interface ProcessState {
  /** Unique process ID assigned by Lua. */
  id: string | null;
  /** True while the process is running. */
  running: boolean;
  /** Exit code (null while running). */
  exitCode: number | null;
  /** Accumulated stdout (last N lines). */
  stdout: string;
  /** Accumulated stderr (last N lines). */
  stderr: string;
}

// ============================================================================
// Hook return types
// ============================================================================

export interface UseEnvironmentResult {
  /** Current environment state. */
  state: EnvironmentState;
  /** Install additional packages into the environment. */
  install: (packages: string[]) => Promise<void>;
  /** Run a command inside the environment. Returns process ID. */
  run: (command: string, opts?: Partial<ProcessConfig>) => Promise<string>;
  /** Delete the environment from disk. */
  destroy: () => Promise<void>;
  /** Re-create the environment (destroy + create). */
  rebuild: () => Promise<void>;
  /** Shorthand: true once env is ready. */
  ready: boolean;
}

export interface UseProcessResult {
  /** Current process state. */
  state: ProcessState;
  /** Write to stdin (or PTY input). */
  send: (data: string) => void;
  /** Send a line (appends newline). */
  sendLine: (line: string) => void;
  /** Resize the PTY (only if pty mode). */
  resize: (rows: number, cols: number) => void;
  /** Kill the process. */
  kill: (signal?: number) => void;
  /** True while the process is running. */
  running: boolean;
  /** Exit code (null while running). */
  exitCode: number | null;
}

export interface UseEnvironmentsResult {
  /** All known environments. */
  environments: EnvironmentState[];
  /** Refresh the list from disk. */
  refresh: () => Promise<void>;
  /** Delete an environment by name. */
  remove: (name: string) => Promise<void>;
}
