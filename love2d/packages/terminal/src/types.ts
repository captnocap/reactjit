export interface PermissionInfo {
  action: string;
  target: string;
  question: string;
}

export interface QuestionInfo {
  question: string;
  options: string[];
}

export interface ClassifiedRow {
  row: number;
  kind: string;
  text: string;
  nodeId?: string;
  turnId?: string;
  groupId?: string;
  groupType?: string;
  colors?: any;
}

export interface ClassifiedResult {
  rows: ClassifiedRow[];
  mode: string;
  boundary: number;
  placeholder?: string;
  promptText?: string;
  promptCursorCol?: number;
  cursorVisible?: boolean;
}

export interface SessionChromeState {
  statusLeft: string;
  statusRight: string;
  placeholder: string;
  promptText: string;
  cursorPosition: number;
}

export interface ClaudeState {
  perm: PermissionInfo | null;
  question: QuestionInfo | null;
  status: string;
  autoAccept: boolean;
  toggleAutoAccept: () => Promise<void>;
  onPerm: (e: any) => void;
  onPermResolved: () => void;
  onQuestion: (e: any) => void;
  onStatusChange: (e: any) => void;
  respond: (choice: number) => void;
  respondQuestion: (optionIndex: number) => void;
}
