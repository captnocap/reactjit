// Icon registry — maps string names to polyline data from @reactjit/icons (icons.ts).
//
// TREE-SHAKING CONTRACT:
//   - Icons in icons.ts are named exports of shape `number[][]` (flat polylines
//     in a 24x24 viewBox). Each is individually tree-shakable.
//   - This module does NOT auto-register every icon. That would force esbuild
//     to retain all ~1,500 exports and balloon the bundle by ~400KB.
//   - Users who want the string form `<Icon name="heart">` must explicitly
//     `registerIcons({ Heart })` at startup — only the names they register
//     survive tree-shaking.
//   - Users who prefer zero ceremony can pass the data directly:
//     `<Icon icon={Heart} />` — equally tree-shakable, no registry involved.

const registry = new Map<string, number[][]>();
const lowerMap = new Map<string, string>();

export function registerIcon(name: string, paths: number[][]): void {
  registry.set(name, paths);
  lowerMap.set(name.toLowerCase(), name);
}

export function registerIcons(icons: Record<string, number[][]>): void {
  for (const name in icons) {
    const val = icons[name];
    if (Array.isArray(val)) registerIcon(name, val);
  }
}

// kebab-case or snake_case → PascalCase: "arrow-down" → "ArrowDown", "maximize-2" → "Maximize2"
function toPascalCase(s: string): string {
  return s.replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/[-_]/g, '');
}

// Semantic aliases — short names → real Lucide names. Extend as needed.
const ALIASES: Record<string, string> = {
  'stop': 'CircleStop',
  'search': 'Search',
  'settings': 'Settings',
  'menu': 'Menu',
  'mouse': 'MousePointer',
  'atom': 'Atom',
  'cloud-rain': 'CloudRain',
  'flask': 'FlaskConical',
  'presentation': 'Presentation',
  'rss': 'Rss',
  'trending-up': 'TrendingUp',
  'home': 'Home',
  'folder': 'Folder',
  'folder-open': 'FolderOpen',
  'file': 'File',
  'file-code': 'FileCode',
  'file-json': 'FileJson',
  'file-text': 'FileText',
  'trash': 'Trash2',
  'edit': 'Pencil',
  'copy': 'Copy',
  'paste': 'ClipboardPaste',
  'save': 'Save',
  'download': 'Download',
  'upload': 'Upload',
  'refresh': 'RefreshCw',
  'close': 'X',
  'check': 'Check',
  'plus': 'Plus',
  'minus': 'Minus',
  'info': 'Info',
  'warning': 'TriangleAlert',
  'warn': 'TriangleAlert',
  'error': 'CircleX',
  'help': 'CircleHelp',
  'question-mark': 'CircleHelp',
  'link': 'Link',
  'unlink': 'Unlink',
  'lock': 'Lock',
  'unlock': 'Unlock',
  'eye': 'Eye',
  'eye-off': 'EyeOff',
  'star': 'Star',
  'heart': 'Heart',
  'bookmark': 'Bookmark',
  'pin': 'Pin',
  'filter': 'Filter',
  'sort': 'ArrowUpDown',
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
  'arrow-up': 'ArrowUp',
  'arrow-down': 'ArrowDown',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
  'chevron-up': 'ChevronUp',
  'chevron-down': 'ChevronDown',
  'move': 'Move',
  'maximize': 'Maximize',
  'minimize': 'Minimize',
  'expand': 'Expand',
  'shrink': 'Shrink',
  'external-link': 'ExternalLink',
  'image': 'Image',
  'video': 'Video',
  'music': 'Music',
  'camera': 'Camera',
  'mic': 'Mic',
  'volume': 'Volume2',
  'speaker': 'Speaker',
  'database': 'Database',
  'table': 'Table',
  'chart': 'ChartLine',
  'code': 'Code',
  'terminal': 'Terminal',
  'git': 'GitBranch',
  'git-branch': 'GitBranch',
  'git-commit': 'GitCommitHorizontal',
  'bug': 'Bug',
  'cpu': 'Cpu',
  'globe': 'Globe',
  'server': 'Server',
  'cloud': 'Cloud',
  'wifi': 'Wifi',
  'zap': 'Zap',
  'sun': 'Sun',
  'moon': 'Moon',
  'clock': 'Clock',
  'calendar': 'Calendar',
  'mail': 'Mail',
  'message': 'MessageSquare',
  'chat': 'MessageSquare',
  'send': 'Send',
  'phone': 'Phone',
  'user': 'User',
  'users': 'Users',
  'shield': 'Shield',
  'key': 'Key',
  'tag': 'Tag',
  'box': 'Box',
  'package': 'Package',
  'layers': 'Layers',
  'grid': 'Grid3x3',
  'list': 'List',
  'hash': 'Hash',
  'at': 'AtSign',
  'at-sign': 'AtSign',
  'alert': 'TriangleAlert',
  'bell': 'Bell',
  'book': 'Book',
  'book-open': 'BookOpen',
  'map': 'Map',
  'compass': 'Compass',
  'flag': 'Flag',
  'target': 'Target',
  'palette': 'Palette',
  'ruler': 'Ruler',
  'keyboard': 'Keyboard',
  'play': 'Play',
  'pause': 'Pause',
  'scissors': 'Scissors',
  'bot': 'Bot',
  'sparkles': 'Sparkles',
  'panel-left': 'PanelLeft',
  'panel-right': 'PanelRight',
  'panel-bottom': 'PanelBottom',
  'pencil': 'Pencil',
  'dots-vertical': 'EllipsisVertical',
  'x': 'X',
  'braces': 'Braces',
  'command': 'Command',
  'flame': 'Flame',
  'graph': 'Waypoints',
  'network': 'Network',
  'wallet': 'Wallet',
  'house': 'Home',
};

export function lookupIcon(name: string): number[][] | undefined {
  const direct = registry.get(name);
  if (direct) return direct;

  const canonical = lowerMap.get(name.toLowerCase());
  if (canonical) return registry.get(canonical);

  const pascal = toPascalCase(name);
  const pascalHit = registry.get(pascal);
  if (pascalHit) return pascalHit;

  const alias = ALIASES[name] || ALIASES[name.toLowerCase()];
  if (alias) {
    const aliasHit = registry.get(alias);
    if (aliasHit) return aliasHit;
    const caseFix = lowerMap.get(alias.toLowerCase());
    if (caseFix) return registry.get(caseFix);
  }

  return undefined;
}
