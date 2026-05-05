export type PaletteCommand = {
  id: string;
  label: string;
  category?: string;
  shortcut?: string;
  action: () => void;
};

export interface SettingsSectionRef {
  id: string;
  label: string;
}

export interface MenuSectionRef {
  label: string;
  items: Array<{ label: string; shortcut?: string; action?: () => void; kind?: string }>;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  commands: PaletteCommand[];
  files?: string[];
  settingsSections?: SettingsSectionRef[];
  menuSections?: MenuSectionRef[];
  onOpenFile?: (path: string) => void;
  onJumpToSettingsSection?: (sectionId: string) => void;
}

export type PaletteMode = 'normal' | 'goto' | 'shell';

export interface PaletteSettings {
  fuzzyMode: 'strict' | 'loose';
  maxResults: number;
  previewEnabled: boolean;
}

export type GroupedCategory = { category: string; items: PaletteCommand[] };
