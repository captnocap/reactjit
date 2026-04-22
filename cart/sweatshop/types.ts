export type WidthBand = 'minimum' | 'widget' | 'narrow' | 'medium' | 'desktop';

export type Tab = {
  id: string;
  name: string;
  path: string;
  type: string;
  modified: number;
  pinned: number;
  git: string;
};

export type FileItem = {
  name: string;
  path: string;
  type: string;
  indent: number;
  expanded: number;
  selected: number;
  visible: number;
  git: string;
  hot: number;
};

export type Breadcrumb = {
  label: string;
  icon: string;
  tone: string;
  active: number;
  kind: string;
  meta?: string;
};

export type SearchResult = {
  file: string;
  line: number;
  text: string;
  matches: number;
};

export type ToolExecution = {
  id: string;
  name: string;
  input: string;
  status: string;
  percent: number;
  result: string;
};

export type Message = {
  role: string;
  time: string;
  text: string;
  mode?: string;
  model?: string;
  attachments?: Array<{ id: string; type: string; name: string; path: string }>;
  toolSnapshot?: ToolExecution[];
};

export type TerminalHistoryEntry = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  time: number;
  path?: string;
};

export type Provider = {
  id: string;
  short: string;
  name: string;
  tone: string;
  status: string;
  driver: string;
  env: string;
  defaultModel: string;
  route: string;
  summary: string;
  detail: string;
  pressure: string;
  capabilities: string[];
};
