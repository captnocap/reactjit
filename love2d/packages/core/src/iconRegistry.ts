/**
 * Icon registry — a global Map populated by @reactjit/icons on import.
 *
 * This lets <Image src="heart" /> resolve to a vector icon automatically
 * when the icons package is loaded. If icons aren't imported, the registry
 * is empty and Image falls through to normal raster loading.
 */

const registry = new Map<string, number[][]>();
const lowerMap = new Map<string, string>(); // lowercase → canonical PascalCase

export function registerIcon(name: string, paths: number[][]) {
  registry.set(name, paths);
  lowerMap.set(name.toLowerCase(), name);
}

export function registerIcons(icons: Record<string, number[][]>) {
  for (const name in icons) {
    const val = icons[name];
    if (Array.isArray(val)) registerIcon(name, val);
  }
}

/** kebab-case or snake_case → PascalCase: "arrow-down" → "ArrowDown", "maximize-2" → "Maximize2" */
function toPascalCase(s: string): string {
  return s.replace(/(^|[-_])([a-z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/[-_]/g, '');
}

/**
 * Semantic alias map — short intuitive names → real Lucide icon names.
 * Grows over time as people hit missing icons. Add entries here instead of
 * hunting down every <Image src="..."> that guessed wrong.
 */
const ALIASES: Record<string, string> = {
  // layout & spacing
  'space-between': 'AlignVerticalSpaceBetween',
  'space-around': 'AlignVerticalSpaceAround',
  'between-horizontal-start': 'BetweenHorizontalStart',
  'between-horizontal-end': 'BetweenHorizontalEnd',
  'between-vertical-start': 'BetweenVerticalStart',
  'between-vertical-end': 'BetweenVerticalEnd',
  'align-center': 'AlignCenter',
  'align-left': 'AlignLeft',
  'align-right': 'AlignRight',
  'align-justify': 'AlignJustify',

  // text & typography
  'bold': 'Bold',
  'italic': 'Italic',
  'underline': 'Underline',
  'strikethrough': 'Strikethrough',
  'type': 'Type',
  'text': 'Text',
  'text-cursor-input': 'TextCursorInput',
  'wrap-text': 'WrapText',
  'pilcrow': 'Pilcrow',
  'heading': 'Heading',
  'subscript': 'Subscript',
  'superscript': 'Superscript',
  'spell-check': 'SpellCheck',
  'letter-text': 'LetterText',

  // common UI
  'layout': 'Layout',
  'ruler': 'Ruler',
  'palette': 'Palette',
  'scissors': 'Scissors',
  'keyboard': 'Keyboard',
  'play': 'Play',
  'pause': 'Pause',
  'stop': 'CircleStop',
  'search': 'Search',
  'settings': 'Settings',
  'menu': 'Menu',
  'home': 'Home',
  'folder': 'Folder',
  'file': 'File',
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
  'error': 'CircleX',
  'help': 'CircleHelp',
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

  // arrows & navigation
  'arrow-left': 'ArrowLeft',
  'arrow-right': 'ArrowRight',
  'arrow-up': 'ArrowUp',
  'arrow-down': 'ArrowDown',
  'arrow-right-left': 'ArrowRightLeft',
  'arrow-up-down': 'ArrowUpDown',
  'chevron-left': 'ChevronLeft',
  'chevron-right': 'ChevronRight',
  'chevron-up': 'ChevronUp',
  'chevron-down': 'ChevronDown',
  'move': 'Move',
  'move-vertical': 'MoveVertical',
  'move-horizontal': 'MoveHorizontal',
  'maximize': 'Maximize',
  'minimize': 'Minimize',
  'expand': 'Expand',
  'shrink': 'Shrink',
  'external-link': 'ExternalLink',

  // media
  'image': 'Image',
  'video': 'Video',
  'music': 'Music',
  'camera': 'Camera',
  'mic': 'Mic',
  'volume': 'Volume2',
  'speaker': 'Speaker',

  // data & charts
  'database': 'Database',
  'table': 'Table',
  'chart': 'ChartLine',
  'bar-chart': 'ChartBar',
  'pie-chart': 'ChartPie',

  // dev & code
  'code': 'Code',
  'terminal': 'Terminal',
  'git-branch': 'GitBranch',
  'git-commit': 'GitCommitHorizontal',
  'bug': 'Bug',
  'cpu': 'Cpu',
  'globe': 'Globe',
  'server': 'Server',
  'cloud': 'Cloud',
  'wifi': 'Wifi',
  'bluetooth': 'Bluetooth',
  'zap': 'Zap',

  // misc
  'sun': 'Sun',
  'moon': 'Moon',
  'clock': 'Clock',
  'calendar': 'Calendar',
  'mail': 'Mail',
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
  'at-sign': 'AtSign',
  'alert': 'TriangleAlert',
  'bell': 'Bell',
  'book': 'Book',
  'book-open': 'BookOpen',
  'map': 'Map',
  'compass': 'Compass',
  'flag': 'Flag',
  'target': 'Target',
  'award': 'Award',
  'gift': 'Gift',
  'smile': 'Smile',
  'frown': 'Frown',
  'thumbs-up': 'ThumbsUp',
  'thumbs-down': 'ThumbsDown',
};

export function lookupIcon(name: string): number[][] | undefined {
  // Direct match (PascalCase)
  const direct = registry.get(name);
  if (direct) return direct;

  // Case-insensitive
  const canonical = lowerMap.get(name.toLowerCase());
  if (canonical) return registry.get(canonical);

  // kebab/snake → PascalCase: "arrow-down" / "arrow_down" → "ArrowDown"
  const pascal = toPascalCase(name);
  const pascalResult = registry.get(pascal);
  if (pascalResult) return pascalResult;

  // Semantic alias: "space-between" → "AlignVerticalSpaceBetween", etc.
  const alias = ALIASES[name] || ALIASES[name.toLowerCase()];
  if (alias) {
    const aliasResult = registry.get(alias);
    if (aliasResult) return aliasResult;
    // Alias might itself need case conversion
    const aliasCaseFix = lowerMap.get(alias.toLowerCase());
    if (aliasCaseFix) return registry.get(aliasCaseFix);
  }

  return undefined;
}
