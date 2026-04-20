const React: any = require('react');
const { useEffect, useRef, useState } = React;

import {
  Box,
  Col,
  Native,
  Pressable,
  Row,
  ScrollView,
  Text,
  TextArea,
  TextEditor,
  TextInput,
} from '../../runtime/primitives';
import {
  buildSeedMessages,
  focusPaths,
  SETTINGS_AUTOMATION_ROWS,
  SETTINGS_CAPABILITY_ROWS,
  SETTINGS_CONTEXT_ROWS,
  SETTINGS_MEMORY_ROWS,
  SETTINGS_PLUGIN_ROWS,
  SETTINGS_PROVIDERS,
} from './data';
import {
  closeWindow,
  exec,
  maximizeWindow,
  minimizeWindow,
  ptyOpen,
  readFile,
  telSystem,
  writeFile,
} from './host';
import {
  baseName,
  COLORS,
  fileGlyph,
  fileTone,
  inferFileType,
  languageForType,
  parentPath,
  samePath,
  statusLabel,
  statusTone,
  stripDotSlash,
  takeList,
  visibleBreadcrumbs,
  visibleTabs,
  widthBandForSize,
} from './theme';

type WidthBand = 'minimum' | 'widget' | 'narrow' | 'medium' | 'desktop';

type Tab = {
  id: string;
  name: string;
  path: string;
  type: string;
  modified: number;
  pinned: number;
  git: string;
};

type FileItem = {
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

type Breadcrumb = {
  label: string;
  icon: string;
  tone: string;
  active: number;
  kind: string;
  meta?: string;
};

type SearchResult = {
  file: string;
  line: number;
  text: string;
  matches: number;
};

type ToolExecution = {
  id: string;
  name: string;
  input: string;
  status: string;
  percent: number;
  result: string;
};

type Message = {
  role: string;
  time: string;
  text: string;
  mode?: string;
  model?: string;
  attachments?: Array<{ id: string; type: string; name: string; path: string }>;
  toolSnapshot?: ToolExecution[];
};

function iconLabel(icon: string): string {
  if (icon === 'house') return 'HM';
  if (icon === 'package') return 'WS';
  if (icon === 'folder') return 'FD';
  if (icon === 'folder-open') return 'FO';
  if (icon === 'file-code') return 'TS';
  if (icon === 'file-json') return 'JS';
  if (icon === 'file-text') return 'TX';
  if (icon === 'palette') return 'PL';
  if (icon === 'braces') return '{}';
  if (icon === 'terminal') return 'SH';
  if (icon === 'panel-left') return 'ED';
  if (icon === 'search') return 'SR';
  if (icon === 'message') return 'AG';
  if (icon === 'git') return 'BR';
  if (icon === 'bot') return 'AI';
  if (icon === 'globe') return 'WB';
  if (icon === 'sparkles') return 'FX';
  if (icon === 'refresh') return 'RF';
  if (icon === 'close') return 'X';
  if (icon === 'plus') return '+';
  if (icon === 'hash') return '#';
  if (icon === 'at') return '@';
  if (icon === 'send') return '->';
  if (icon === 'info') return 'i';
  if (icon === 'warn') return '!';
  return icon.length <= 2 ? icon : icon.slice(0, 2).toUpperCase();
}

function trimLines(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => stripDotSlash(line.trimEnd()))
    .filter((line) => line.length > 0);
}

function primaryMainView(activeView: string, currentFilePath: string): 'landing' | 'settings' | 'editor' {
  if (activeView === 'landing' || currentFilePath === '__landing__') return 'landing';
  if (activeView === 'settings' || currentFilePath === '__settings__') return 'settings';
  return 'editor';
}

function estimateTokens(text: string, attachments: Array<{ type: string }>): number {
  let estimate = Math.ceil((text || '').length / 4);
  for (const attachment of attachments) {
    estimate += attachment.type === 'git' ? 900 : 500;
  }
  return estimate;
}

function previousNonSpace(line: string, idx: number): string {
  let i = idx;
  while (i >= 0) {
    const ch = line.charAt(i);
    if (ch !== ' ' && ch !== '\t') return ch;
    i -= 1;
  }
  return '';
}

function nextNonSpace(line: string, idx: number): string {
  let i = idx;
  while (i < line.length) {
    const ch = line.charAt(i);
    if (ch !== ' ' && ch !== '\t') return ch;
    i += 1;
  }
  return '';
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isWordStart(ch: string): boolean {
  return (
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    ch === '_' ||
    ch === '$'
  );
}

function isWordChar(ch: string): boolean {
  return isWordStart(ch) || isDigit(ch);
}

function isKeyword(word: string): boolean {
  return [
    'import', 'from', 'export', 'function', 'return', 'const', 'let', 'var',
    'if', 'else', 'for', 'while', 'async', 'await', 'try', 'catch', 'interface',
    'type', 'extends', 'new', 'class', 'declare', 'useState',
  ].includes(word);
}

function isTypeWord(word: string): boolean {
  return [
    'string', 'number', 'boolean', 'void', 'any', 'unknown', 'Promise', 'Set',
    'Map', 'Box', 'Text', 'Pressable', 'ScrollView', 'TextInput',
  ].includes(word);
}

function isPascalWord(word: string): boolean {
  return /^[A-Z][A-Za-z0-9_$]*$/.test(word);
}

function isConstantWord(word: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(word) && word.includes('_');
}

function previousWord(line: string, idx: number): string {
  if (idx < 0) return '';
  const prefix = line.slice(0, idx + 1);
  const match = prefix.match(/([A-Za-z_$][A-Za-z0-9_$]*)[^A-Za-z0-9_$]*$/);
  return match ? match[1] : '';
}

function tokenizeLine(line: string, context?: { inImportSpecifiers?: boolean }): Array<{ text: string; kind: string }> {
  const tokens: Array<{ text: string; kind: string }> = [];
  let i = 0;
  const inImportSpecifiers = !!context?.inImportSpecifiers;

  while (i < line.length) {
    const ch = line.charAt(i);
    const next = i + 1 < line.length ? line.charAt(i + 1) : '';

    if (ch === ' ' || ch === '\t') {
      const start = i;
      while (i < line.length && (line.charAt(i) === ' ' || line.charAt(i) === '\t')) i += 1;
      tokens.push({ text: line.slice(start, i), kind: 'text' });
      continue;
    }

    if (ch === '/' && next === '/') {
      tokens.push({ text: line.slice(i), kind: 'comment' });
      break;
    }

    if (ch === '"' || ch === '\'' || ch === '`') {
      const quote = ch;
      const start = i;
      i += 1;
      while (i < line.length) {
        if (line.charAt(i) === quote && line.charAt(i - 1) !== '\\') {
          i += 1;
          break;
        }
        i += 1;
      }
      tokens.push({ text: line.slice(start, i), kind: 'string' });
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      i += 1;
      while (i < line.length && (isDigit(line.charAt(i)) || line.charAt(i) === '.')) i += 1;
      tokens.push({ text: line.slice(start, i), kind: 'number' });
      continue;
    }

    if (ch === '<') {
      tokens.push({ text: '<', kind: 'tag' });
      i += 1;
      if (line.charAt(i) === '/') {
        tokens.push({ text: '/', kind: 'tag' });
        i += 1;
      }
      const start = i;
      while (i < line.length && isWordChar(line.charAt(i))) i += 1;
      if (i > start) tokens.push({ text: line.slice(start, i), kind: 'tag' });
      continue;
    }

    if (isWordStart(ch)) {
      const start = i;
      i += 1;
      while (i < line.length && isWordChar(line.charAt(i))) i += 1;
      const word = line.slice(start, i);
      const prev = previousNonSpace(line, start - 1);
      const prevWordName = previousWord(line, start - 1);
      const nextCh = nextNonSpace(line, i);
      let kind = 'text';
      if (isKeyword(word) || word === 'as') kind = 'keyword';
      else if (inImportSpecifiers) {
        if (isConstantWord(word)) kind = 'constant';
        else if (isPascalWord(word) || isTypeWord(word)) kind = 'type';
        else kind = 'imported';
      } else if (isConstantWord(word)) kind = 'constant';
      else if (isTypeWord(word)) kind = 'type';
      else if (prev === '<' || (prev === '/' && previousNonSpace(line, start - 2) === '<')) kind = 'tag';
      else if (nextCh === '=' && line.indexOf('<') >= 0) kind = 'attr';
      else if (prev === '.') kind = 'property';
      else if (prevWordName === 'const' || prevWordName === 'let' || prevWordName === 'var' || prevWordName === 'function' || prevWordName === 'class' || prevWordName === 'interface' || prevWordName === 'type') kind = 'symbol';
      else if (nextCh === '(' || word.startsWith('use')) kind = 'function';
      else if (isPascalWord(word)) kind = 'type';
      else if (word === 'props' || word === 'msg' || word === 'state') kind = 'variable';
      tokens.push({ text: word, kind });
      continue;
    }

    if ('{}[]()=:+-*%!&|?/'.includes(ch)) {
      tokens.push({ text: ch, kind: 'operator' });
      i += 1;
      continue;
    }

    if (ch === '>' && previousNonSpace(line, i - 1) !== '=') {
      tokens.push({ text: '>', kind: 'tag' });
      i += 1;
      continue;
    }

    tokens.push({ text: ch, kind: 'text' });
    i += 1;
  }

  if (tokens.length === 0) tokens.push({ text: ' ', kind: 'text' });
  return tokens;
}

function lineMarker(line: string): string {
  if (line.includes('TODO') || line.includes('FIXME')) return 'todo';
  if (line.includes('function ') || line.includes('export ')) return 'symbol';
  if (line.includes('__exec') || line.includes('git ') || line.includes('curl ')) return 'tool';
  if (line.includes('return ')) return 'flow';
  return '';
}

function editorAccentTone(marker: string, active: boolean): string {
  if (active) return COLORS.blue;
  if (marker === 'todo') return COLORS.red;
  if (marker === 'symbol') return COLORS.blue;
  if (marker === 'tool') return COLORS.green;
  if (marker === 'flow') return COLORS.purple;
  return '#202938';
}

function editorTokenTone(kind: string): string {
  if (kind === 'comment') return '#6f9973';
  if (kind === 'string') return '#a5d6a7';
  if (kind === 'number') return '#79c0ff';
  if (kind === 'keyword') return '#c7a8ff';
  if (kind === 'type') return '#90cdf4';
  if (kind === 'imported') return '#79c0ff';
  if (kind === 'symbol') return '#d2a8ff';
  if (kind === 'constant') return '#ffb86b';
  if (kind === 'property') return '#b8c5d6';
  if (kind === 'tag') return '#7ee787';
  if (kind === 'attr') return '#f2c572';
  if (kind === 'function') return '#f2c572';
  if (kind === 'variable') return '#d9e2f2';
  if (kind === 'operator') return '#8b9bb0';
  return COLORS.text;
}

function Glyph(props: { icon: string; tone?: string; backgroundColor?: string; tiny?: boolean }) {
  return (
    <Box
      style={{
        paddingLeft: props.tiny ? 4 : 5,
        paddingRight: props.tiny ? 4 : 5,
        paddingTop: props.tiny ? 2 : 3,
        paddingBottom: props.tiny ? 2 : 3,
        borderRadius: props.tiny ? 4 : 5,
        backgroundColor: props.backgroundColor || COLORS.grayChip,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: props.tiny ? 18 : 22,
      }}
    >
      <Text fontSize={props.tiny ? 8 : 9} color={props.tone || COLORS.textBright} style={{ fontWeight: 'bold' }}>
        {iconLabel(props.icon)}
      </Text>
    </Box>
  );
}

function Pill(props: { label: string; color?: string; borderColor?: string; backgroundColor?: string; tiny?: boolean }) {
  return (
    <Box
      style={{
        paddingLeft: props.tiny ? 6 : 8,
        paddingRight: props.tiny ? 6 : 8,
        paddingTop: props.tiny ? 3 : 5,
        paddingBottom: props.tiny ? 3 : 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: props.borderColor || COLORS.border,
        backgroundColor: props.backgroundColor || COLORS.panelAlt,
      }}
    >
      <Text fontSize={props.tiny ? 9 : 10} color={props.color || COLORS.text}>
        {props.label}
      </Text>
    </Box>
  );
}

function HeaderButton(props: any) {
  const active = props.active === 1;
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: props.compact ? 0 : 6,
        paddingLeft: props.compact ? 8 : 10,
        paddingRight: props.compact ? 8 : 10,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: active ? COLORS.blue : COLORS.border,
        backgroundColor: active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Glyph icon={props.icon} tone={active ? COLORS.blue : COLORS.textMuted} backgroundColor="transparent" tiny={true} />
      {!props.compact && (
        <Text fontSize={10} color={active ? COLORS.blue : COLORS.text} style={{ fontWeight: 'bold' }}>
          {props.label}
        </Text>
      )}
      {!props.compact && props.meta ? (
        <Text fontSize={9} color={COLORS.textDim}>
          {props.meta}
        </Text>
      ) : null}
    </Pressable>
  );
}

function CompactSurfaceButton(props: any) {
  return (
    <Pressable
      onPress={props.onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: props.showLabel ? 6 : 0,
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 7,
        paddingBottom: 7,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: props.active ? COLORS.blue : COLORS.border,
        backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
      }}
    >
      <Glyph icon={props.icon} tone={props.active ? COLORS.blue : COLORS.textMuted} backgroundColor="transparent" tiny={true} />
      {props.showLabel ? (
        <Text fontSize={10} color={props.active ? COLORS.blue : COLORS.text}>
          {props.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

function BreadcrumbBar(props: any) {
  if (!props.items || props.items.length === 0) return null;
  return (
    <Row
      style={{
        paddingLeft: props.compact ? 10 : 12,
        paddingRight: props.compact ? 10 : 12,
        paddingTop: props.compact ? 7 : 9,
        paddingBottom: props.compact ? 7 : 9,
        gap: props.compact ? 4 : 6,
        alignItems: 'center',
        backgroundColor: COLORS.panelRaised,
        borderBottomWidth: 1,
        borderColor: COLORS.borderSoft,
        flexWrap: 'wrap',
      }}
    >
      {props.items.map((crumb: Breadcrumb, idx: number) => (
        <Pressable
          key={crumb.label + '_' + idx}
          onPress={crumb.kind === 'home' || crumb.kind === 'workspace' ? props.onOpenHome : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          {idx > 0 ? <Text fontSize={9} color={COLORS.textDim}>{'>'}</Text> : null}
          <Glyph icon={crumb.icon} tone={crumb.tone} backgroundColor={COLORS.panelAlt} tiny={true} />
          <Text fontSize={11} color={crumb.active ? COLORS.textBright : COLORS.text}>
            {crumb.label}
          </Text>
          {crumb.meta ? <Text fontSize={10} color={COLORS.textDim}>{crumb.meta}</Text> : null}
        </Pressable>
      ))}
    </Row>
  );
}

function TopBar(props: any) {
  const compact = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimum = props.widthBand === 'minimum';
  return (
    <Row
      windowDrag={true}
      style={{
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: COLORS.panelBg,
        borderBottomWidth: 1,
        borderColor: COLORS.border,
        minHeight: 42,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8, flexGrow: 1, flexBasis: 0 }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Pressable onPress={closeWindow}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff5f57' }} /></Pressable>
          <Pressable onPress={minimizeWindow}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#febc2e' }} /></Pressable>
          <Pressable onPress={maximizeWindow}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#28c840' }} /></Pressable>
        </Row>

        <Pressable
          onPress={props.onOpenHome}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: minimum ? 0 : 6,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 10,
            backgroundColor: COLORS.panelAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
          }}
        >
          <Glyph icon="package" tone={COLORS.blue} backgroundColor="transparent" tiny={true} />
          {!minimum ? (
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
              {props.workspaceName}
            </Text>
          ) : null}
        </Pressable>

        <Pressable
          onPress={props.onOpenHome}
          style={{
            flexDirection: 'column',
            gap: 1,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 10,
            backgroundColor: COLORS.panelAlt,
            borderWidth: 1,
            borderColor: COLORS.border,
            flexGrow: 1,
            flexBasis: 0,
          }}
        >
          {!compact ? <Text fontSize={9} color={COLORS.blue}>Project landing</Text> : null}
          <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {props.displayTitle}
          </Text>
        </Pressable>
      </Row>

      <Row style={{ alignItems: 'center', gap: 8, marginLeft: 10 }}>
        <Row
          style={{
            alignItems: 'center',
            gap: 6,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelAlt,
          }}
        >
          <Glyph icon="git" tone={COLORS.green} backgroundColor="transparent" tiny={true} />
          <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
          {!compact ? <Text fontSize={9} color={COLORS.textDim}>{props.changedCount + ' dirty / ' + props.stagedCount + ' staged'}</Text> : null}
        </Row>
        <HeaderButton label="Refresh" meta="R" icon="refresh" compact={compact} onPress={props.onRefreshWorkspace} />
        <HeaderButton label="Settings" meta="S" icon="palette" compact={compact} active={props.settingsActive ? 1 : 0} onPress={props.onOpenSettings} />
        <HeaderButton label="Search" meta="F3" icon="search" compact={compact} active={props.searchActive ? 1 : 0} onPress={props.onToggleSearch} />
        <HeaderButton label="Terminal" meta="~" icon="terminal" compact={compact} active={props.terminalActive ? 1 : 0} onPress={props.onToggleTerminal} />
        <HeaderButton label="Agent" icon="message" compact={compact} active={props.chatActive ? 1 : 0} onPress={props.onToggleChat} />
      </Row>
    </Row>
  );
}

function TabBar(props: any) {
  return (
    <Row style={{ backgroundColor: COLORS.panelBg, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
      {props.tabs.map((tab: Tab) => {
        const active = tab.id === props.activeId;
        return (
          <Pressable
            key={tab.id}
            onPress={() => props.onActivate(tab.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: props.compact ? 6 : 8,
              paddingLeft: props.compact ? 10 : 12,
              paddingRight: props.compact ? 8 : 10,
              paddingTop: props.compact ? 7 : 8,
              paddingBottom: props.compact ? 7 : 8,
              borderRightWidth: 1,
              borderColor: COLORS.borderSoft,
              borderTopWidth: 2,
              borderTopColor: active ? COLORS.blue : 'transparent',
              backgroundColor: active ? COLORS.panelAlt : COLORS.panelBg,
            }}
          >
            <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
            <Text fontSize={11} color={active ? COLORS.textBright : COLORS.text}>{tab.name}</Text>
            {!props.compact && tab.git ? <Pill label={tab.git} color={COLORS.blue} tiny={true} /> : null}
            {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
            {!props.compact && !tab.pinned ? (
              <Pressable onPress={() => props.onClose(tab.id)} style={{ paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}>
                <Text fontSize={10} color={COLORS.textDim}>X</Text>
              </Pressable>
            ) : null}
          </Pressable>
        );
      })}
    </Row>
  );
}

function Sidebar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';
  const openEditorLimit = compactBand ? 8 : mediumBand ? 4 : 6;
  const changeLimit = compactBand ? 8 : mediumBand ? 4 : 6;

  return (
    <Col
      style={{
        width: props.style?.width || 280,
        height: '100%',
        backgroundColor: COLORS.panelBg,
        borderRightWidth: 1,
        borderColor: COLORS.border,
        ...props.style,
      }}
    >
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12 }}>
        <Text fontSize={11} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          {compactBand ? 'FILES' : 'WORKSPACE'}
        </Text>
        <Row style={{ gap: 8 }}>
          <Pressable onPress={props.onRefreshWorkspace}><Text fontSize={10} color={COLORS.blue}>RF</Text></Pressable>
          <Pressable onPress={props.onCreateFile}><Text fontSize={10} color={COLORS.blue}>+</Text></Pressable>
        </Row>
      </Row>

      <Pressable
        onPress={props.onOpenHome}
        style={{
          marginLeft: 12,
          marginRight: 12,
          marginBottom: 12,
          padding: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.panelRaised,
        }}
      >
        <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{props.workspaceName}</Text>
        <Row style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
          <Pill label={String(props.changedCount) + ' dirty'} color={COLORS.yellow} tiny={true} />
          {!mediumBand ? <Pill label={String(props.stagedCount) + ' staged'} color={COLORS.blue} tiny={true} /> : null}
        </Row>
        {props.widthBand === 'desktop' ? <Text fontSize={10} color={COLORS.textDim} style={{ marginTop: 8 }}>{props.workDir}</Text> : null}
      </Pressable>

      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingBottom: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>OPEN EDITORS</Text>
      </Box>
      <Box style={{ paddingLeft: 12, paddingRight: 12, gap: 6 }}>
        {props.tabs.slice(0, openEditorLimit).map((tab: Tab) => {
          if (tab.path === '__landing__') return null;
          return (
            <Pressable
              key={tab.id}
              onPress={() => props.onSelectPath(tab.path)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 10,
                backgroundColor: samePath(tab.path, props.currentFilePath) ? COLORS.panelHover : COLORS.panelRaised,
              }}
            >
              <Glyph icon={fileGlyph(tab.type)} tone={fileTone(tab.type)} backgroundColor={COLORS.grayChip} tiny={true} />
              <Text fontSize={11} color={COLORS.text}>{tab.name}</Text>
              {tab.modified ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.yellow }} /> : null}
              <Box style={{ flexGrow: 1 }} />
              {tab.git ? <Pill label={tab.git} color={COLORS.textMuted} tiny={true} /> : null}
            </Pressable>
          );
        })}
      </Box>

      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 14, paddingBottom: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          SOURCE CONTROL
        </Text>
      </Box>
      <Box style={{ paddingLeft: 12, paddingRight: 12, gap: 6 }}>
        {props.gitChanges.slice(0, changeLimit).map((item: any) => (
          <Pressable
            key={item.path}
            onPress={() => props.onSelectPath(item.path)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 8,
              borderRadius: 10,
              backgroundColor: COLORS.panelRaised,
            }}
          >
            <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.tone }} />
            <Text fontSize={10} color={COLORS.textBright}>{item.status}</Text>
            <Text fontSize={10} color={COLORS.textDim}>{item.path}</Text>
          </Pressable>
        ))}
      </Box>

      <Box style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 14, paddingBottom: 8 }}>
        <Text fontSize={10} color={COLORS.textMuted} style={{ fontWeight: 'bold' }}>
          EXPLORER
        </Text>
      </Box>
      <ScrollView style={{ flexGrow: 1, height: '100%', paddingLeft: 8, paddingRight: 8, paddingBottom: 12 }}>
        <Col style={{ gap: 4 }}>
          {props.files.map((file: FileItem) => {
            if (file.visible !== 1) return null;
            return (
              <Pressable
                key={file.path + '_' + file.indent}
                onPress={() => props.onSelectPath(file.path)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingLeft: 10 + file.indent * 12,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 10,
                  backgroundColor: file.selected ? COLORS.panelHover : file.hot ? COLORS.panelRaised : 'transparent',
                }}
              >
                <Text fontSize={9} color={COLORS.textDim}>{file.type === 'dir' ? (file.expanded ? 'v' : '>') : ''}</Text>
                <Glyph
                  icon={file.type === 'dir' ? (file.expanded ? 'folder-open' : 'folder') : fileGlyph(file.type)}
                  tone={file.type === 'dir' ? COLORS.textMuted : fileTone(file.type)}
                  backgroundColor={file.type === 'dir' ? COLORS.grayDeep : COLORS.grayChip}
                  tiny={true}
                />
                <Text fontSize={11} color={file.selected ? COLORS.textBright : COLORS.text}>{file.name}</Text>
                {file.hot ? <Box style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.blue }} /> : null}
                <Box style={{ flexGrow: 1 }} />
                {file.git ? <Pill label={file.git} color={COLORS.textMuted} tiny={true} /> : null}
              </Pressable>
            );
          })}
        </Col>
      </ScrollView>
    </Col>
  );
}

function LandingSurface(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';

  return (
    <ScrollView style={{ flexGrow: 1, height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: compactBand ? 12 : 18, gap: 16 }}>
        <Box
          style={{
            padding: minimumBand ? 14 : 18,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: COLORS.border,
            backgroundColor: COLORS.panelRaised,
            gap: 10,
          }}
        >
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>
            PROJECT LANDING
          </Text>
          <Text fontSize={compactBand ? 20 : 24} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            {props.workspaceName}
          </Text>
          {!minimumBand ? <Text fontSize={11} color={COLORS.textDim}>{props.workDir}</Text> : null}
          {!minimumBand ? <Text fontSize={11} color={COLORS.text}>{props.workspaceTagline}</Text> : null}
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label={'branch ' + props.gitBranch} color={COLORS.green} />
            <Pill label={'remote ' + props.gitRemote} color={COLORS.blue} />
            <Pill label={'sync +' + props.branchAhead + ' / -' + props.branchBehind} color={COLORS.purple} />
            {!minimumBand ? <Pill label={props.changedCount + ' dirty / ' + props.stagedCount + ' staged'} color={COLORS.yellow} /> : null}
          </Row>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pressable onPress={props.onIndexWorkspace} style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={11} color={COLORS.blue}>Index Workspace</Text>
            </Pressable>
            <Pressable onPress={() => props.onOpenPath('cart/cursor-ide/index.tsx')} style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={11} color={COLORS.text}>Open TSX cart</Text>
            </Pressable>
            <Pressable onPress={props.onOpenSettings} style={{ padding: 10, borderRadius: 10, backgroundColor: COLORS.panelAlt, borderWidth: 1, borderColor: COLORS.border }}>
              <Text fontSize={11} color={COLORS.text}>Open Settings Surface</Text>
            </Pressable>
          </Row>
        </Box>

        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          {props.stats.map((stat: any) => (
            <Box key={stat.label} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, minWidth: 110 }}>
              <Text fontSize={18} color={stat.tone} style={{ fontWeight: 'bold' }}>{stat.value}</Text>
              <Text fontSize={10} color={COLORS.textDim}>{stat.label}</Text>
            </Box>
          ))}
        </Row>

        <Row style={{ gap: 14, alignItems: 'flex-start', flexWrap: compactBand ? 'wrap' : 'nowrap' }}>
          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 12 }}>
            <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Projects</Text>
              <Text fontSize={10} color={COLORS.textDim}>Curated entry points into the repo</Text>
              <Col style={{ gap: 8 }}>
                {props.projects.map((item: any) => (
                  <Pressable
                    key={item.name + '_' + item.path}
                    onPress={() => props.onOpenPath(item.path)}
                    style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}
                  >
                    <Row style={{ alignItems: 'center', gap: 8 }}>
                      <Box style={{ width: 8, height: 28, borderRadius: 4, backgroundColor: item.accent }} />
                      <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
                      <Box style={{ flexGrow: 1 }} />
                      <Pill label={item.badge} color={item.accent} tiny={true} />
                    </Row>
                    <Text fontSize={11} color={COLORS.text}>{item.summary}</Text>
                    <Text fontSize={10} color={COLORS.textDim}>{item.displayPath}</Text>
                  </Pressable>
                ))}
              </Col>
            </Box>
          </Col>

          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 12 }}>
            <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Git Connections</Text>
              <Text fontSize={10} color={COLORS.textDim}>Branch, remote, and worktree wiring</Text>
              <Col style={{ gap: 8 }}>
                {props.connections.map((item: any) => (
                  <Row key={item.name + '_' + item.detail} style={{ gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 12, backgroundColor: COLORS.panelAlt }}>
                    <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.tone, marginTop: 5 }} />
                    <Col style={{ gap: 3, flexGrow: 1, flexBasis: 0 }}>
                      <Text fontSize={11} color={COLORS.textBright}>{item.name}</Text>
                      <Text fontSize={10} color={COLORS.textDim}>{item.detail}</Text>
                    </Col>
                  </Row>
                ))}
              </Col>
            </Box>

            <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
              <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Recent Focus</Text>
              <Text fontSize={10} color={COLORS.textDim}>Dirty files, open tabs, and cart hotspots</Text>
              <Col style={{ gap: 8 }}>
                {props.recentFiles.map((item: any) => (
                  <Pressable
                    key={item.path + '_' + item.reason}
                    onPress={() => props.onOpenPath(item.path)}
                    style={{ padding: 10, borderRadius: 12, backgroundColor: COLORS.panelAlt, gap: 6 }}
                  >
                    <Row style={{ alignItems: 'center', gap: 8 }}>
                      <Glyph icon={item.icon} tone={item.tone} backgroundColor={COLORS.grayChip} tiny={true} />
                      <Text fontSize={11} color={COLORS.textBright}>{item.label}</Text>
                      <Box style={{ flexGrow: 1 }} />
                      <Text fontSize={10} color={COLORS.textDim}>{item.reason}</Text>
                    </Row>
                    {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{item.displayPath}</Text> : null}
                  </Pressable>
                ))}
              </Col>
            </Box>
          </Col>
        </Row>
      </Col>
    </ScrollView>
  );
}

function EditorSurface(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';
  const showMinimap = !compactBand && props.windowHeight >= 440;
  const showGutter = !minimumBand;
  const showBadges = !minimumBand;
  const lineStride = compactBand ? 17 : 18;
  const topPad = compactBand ? 12 : 14;
  const bottomPad = compactBand ? 14 : 18;
  const leftPad = compactBand ? 14 : 16;
  const rightPad = compactBand ? 36 : 44;
  const gutterWidth = showGutter ? (compactBand ? 58 : 70) : 0;
  const fileType = inferFileType(props.currentFilePath);
  const fileName = baseName(props.currentFilePath);
  const parent = parentPath(props.currentFilePath);
  const longestColumns = props.editorRows.reduce((max: number, row: any) => Math.max(max, row.charCount || row.text?.length || 0), 0);
  const editorWidth = Math.max(compactBand ? 620 : 860, longestColumns * (compactBand ? 6.9 : 7.35) + leftPad + rightPad);
  const editorHeight = Math.max(220, props.totalLines * lineStride + topPad + bottomPad);
  const canvasWidth = gutterWidth + editorWidth;
  const [editorScrollY, setEditorScrollY] = useState(0);
  const lastScrollStateTimeRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const estimatedViewportHeight = Math.max(160, props.windowHeight - (compactBand ? 260 : 300));
  const overscanRows = 8;
  const visibleRowCount = Math.ceil(estimatedViewportHeight / lineStride) + overscanRows * 2;
  const shouldVirtualizeChrome = props.largeFileMode && props.totalLines > visibleRowCount;
  const visibleStart = shouldVirtualizeChrome ? Math.max(0, Math.floor(Math.max(0, editorScrollY - topPad) / lineStride) - overscanRows) : 0;
  const visibleEnd = shouldVirtualizeChrome ? Math.min(props.editorRows.length, visibleStart + visibleRowCount) : props.editorRows.length;
  const gutterRows = shouldVirtualizeChrome ? props.editorRows.slice(visibleStart, visibleEnd) : props.editorRows;
  const gutterTopSpacer = shouldVirtualizeChrome ? topPad + visibleStart * lineStride : topPad;
  const gutterBottomSpacer = shouldVirtualizeChrome ? bottomPad + Math.max(0, props.totalLines - visibleEnd) * lineStride : bottomPad;
  const minimapSampleCount = props.largeFileMode ? Math.min(220, Math.max(32, Math.floor(estimatedViewportHeight / 2))) : props.editorRows.length;
  const minimapGroupSize = props.editorRows.length > 0 ? Math.max(1, Math.ceil(props.editorRows.length / Math.max(1, minimapSampleCount))) : 1;
  const minimapRows: any[] = [];
  if (showMinimap) {
    for (let idx = 0; idx < props.editorRows.length; idx += minimapGroupSize) {
      const slice = props.editorRows.slice(idx, Math.min(props.editorRows.length, idx + minimapGroupSize));
      if (slice.length === 0) continue;
      let previewWidth = 18;
      let marker = '';
      let active = false;
      for (const row of slice) {
        if (row.previewWidth > previewWidth) previewWidth = row.previewWidth;
        if (!marker && row.marker) marker = row.marker;
        if (row.line === props.cursorLine) active = true;
      }
      minimapRows.push({
        key: 'mini_' + slice[0].line,
        width: previewWidth,
        active,
        marker,
      });
    }
  }

  function syncEditorScroll(payload: any) {
    const next = typeof payload?.scrollY === 'number' ? payload.scrollY : 0;
    if (Math.abs(next - lastScrollYRef.current) < lineStride * 0.5) return;
    const now = Date.now();
    if (now - lastScrollStateTimeRef.current < 50) return;
    lastScrollStateTimeRef.current = now;
    lastScrollYRef.current = next;
    setEditorScrollY(next);
  }

  return (
    <Col style={{ flexGrow: 1, flexBasis: 0, backgroundColor: COLORS.panelBg }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, backgroundColor: COLORS.panelRaised, borderBottomWidth: 1, borderColor: COLORS.borderSoft, gap: 10 }}>
        <Row style={{ gap: 10, alignItems: 'center', flexGrow: 1, flexBasis: 0 }}>
          <Glyph icon={fileGlyph(fileType)} tone={fileTone(fileType)} backgroundColor={COLORS.grayChip} />
          <Col style={{ gap: 3, flexGrow: 1, flexBasis: 0 }}>
            <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{fileName || props.currentFilePath}</Text>
            <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{parent === '.' ? 'workspace root' : parent}</Text> : null}
              <Text fontSize={10} color={COLORS.textDim}>{props.totalLines + ' lines'}</Text>
              {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{longestColumns + ' cols max'}</Text> : null}
            </Row>
          </Col>
        </Row>
        {showBadges ? (
          <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Pill label={props.languageMode} color={fileTone(fileType)} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} />
            <Pill label={props.largeFileMode ? 'large-file mode' : 'native syntax'} color={props.largeFileMode ? COLORS.yellow : COLORS.textMuted} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} />
            {props.modified ? <Pill label="modified" color={COLORS.yellow} backgroundColor={COLORS.yellowDeep} borderColor={COLORS.yellowDeep} tiny={true} /> : <Pill label="saved" color={COLORS.green} backgroundColor={COLORS.greenDeep} borderColor={COLORS.greenDeep} tiny={true} />}
            <Pressable onPress={props.onSave} style={{ padding: 8, borderRadius: 10, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
              <Text fontSize={10} color={COLORS.blue}>Save</Text>
            </Pressable>
          </Row>
        ) : null}
      </Row>

      <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, padding: compactBand ? 8 : 10, gap: 10, backgroundColor: COLORS.panelBg }}>
        <Col style={{ flexGrow: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, backgroundColor: '#0a0f17', overflow: 'hidden' }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: compactBand ? 10 : 12, paddingRight: compactBand ? 10 : 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#111a25', backgroundColor: '#0d131d' }}>
            <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill label={'Ln ' + props.cursorLine} color={COLORS.blue} backgroundColor={COLORS.blueDeep} borderColor={COLORS.blueDeep} tiny={true} />
              {!minimumBand ? <Pill label={'Col ' + props.cursorColumn} color={COLORS.textMuted} backgroundColor={COLORS.grayChip} borderColor={COLORS.border} tiny={true} /> : null}
              {!minimumBand ? <Pill label={props.modified ? 'unsaved buffer' : 'in sync'} color={props.modified ? COLORS.yellow : COLORS.green} backgroundColor={props.modified ? COLORS.yellowDeep : COLORS.greenDeep} borderColor={props.modified ? COLORS.yellowDeep : COLORS.greenDeep} tiny={true} /> : null}
            </Row>
            {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{props.currentFilePath}</Text> : null}
          </Row>

          <ScrollView onScroll={syncEditorScroll} style={{ flexGrow: 1, height: '100%', backgroundColor: '#0a0f17' }}>
            <Row style={{ minHeight: editorHeight, width: canvasWidth, alignItems: 'flex-start' }}>
              {showGutter ? (
                <Col style={{ width: gutterWidth, minHeight: editorHeight, backgroundColor: '#091019', borderRightWidth: 1, borderColor: '#111a25' }}>
                  <Box style={{ height: gutterTopSpacer }} />
                  {gutterRows.map((row: any) => {
                    const active = row.line === props.cursorLine;
                    return (
                      <Row key={row.line} style={{ minHeight: lineStride, alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingLeft: 8, paddingRight: 10, backgroundColor: active ? '#0f1a29' : 'transparent' }}>
                        <Box style={{ width: active ? 7 : 5, height: active ? lineStride - 6 : 5, borderRadius: 4, backgroundColor: editorAccentTone(row.marker, active) }} />
                        <Text fontSize={11} color={active ? COLORS.blue : '#536176'} style={{ fontWeight: active ? 'bold' : 'normal' }}>
                          {String(row.line)}
                        </Text>
                      </Row>
                    );
                  })}
                  <Box style={{ height: gutterBottomSpacer }} />
                </Col>
              ) : null}

              <Box style={{ width: editorWidth, height: editorHeight, position: 'relative', backgroundColor: '#0b1017' }}>
                <TextEditor
                  value={props.content}
                  onChange={props.onChange}
                  paintText={true}
                  colorRows={props.editorColorRows}
                  fontSize={13}
                  color={COLORS.text}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: editorWidth,
                    height: editorHeight,
                    paddingTop: topPad,
                    paddingBottom: bottomPad,
                    paddingLeft: leftPad,
                    paddingRight: rightPad,
                    borderWidth: 0,
                    lineHeight: lineStride,
                  }}
                />
              </Box>
            </Row>
          </ScrollView>
        </Col>

        {showMinimap ? (
          <Col style={{ width: 90, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, backgroundColor: COLORS.panelRaised, padding: 8, gap: 3 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Text fontSize={10} color={COLORS.textDim}>overview</Text>
              <Text fontSize={10} color={COLORS.textDim}>{props.totalLines}</Text>
            </Row>
            <Col style={{ gap: 2 }}>
              {minimapRows.map((row: any) => (
                <Box key={row.key} style={{ height: row.active ? 4 : 3, marginBottom: 1, borderRadius: 2, width: row.width, backgroundColor: row.active ? COLORS.blue : editorAccentTone(row.marker, false) }} />
              ))}
            </Col>
          </Col>
        ) : null}
      </Row>
    </Col>
  );
}

function SearchSurface(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';
  return (
    <Col style={{ width: props.style?.width || '100%', height: '100%', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Col style={{ padding: compactBand ? 12 : 14, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Project Search</Text>
          {!minimumBand ? <Text fontSize={10} color={COLORS.textDim}>{props.workspaceName + ' / ' + props.gitBranch}</Text> : null}
          <Pressable onPress={props.onClose}><Text fontSize={11} color={COLORS.textDim}>X</Text></Pressable>
        </Row>
        <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
          <TextInput value={props.query} onChange={props.onQuery} placeholder="rg query" fontSize={11} color={COLORS.text} style={{ borderWidth: 0, backgroundColor: 'transparent' }} />
        </Box>
        {!minimumBand ? (
          <Row style={{ gap: 8 }}>
            <Pill label="repo" color={COLORS.blue} tiny={true} />
            <Pill label="case" color={COLORS.textDim} tiny={true} />
            <Pill label="regex" color={COLORS.textDim} tiny={true} />
          </Row>
        ) : null}
      </Col>
      <ScrollView style={{ flexGrow: 1, height: '100%', padding: 12 }}>
        <Col style={{ gap: 8 }}>
          {props.results.map((result: SearchResult) => (
            <Pressable key={result.file + ':' + result.line + ':' + result.text} onPress={() => props.onOpenResult(result.file, result.line)} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
              <Row style={{ alignItems: 'center', gap: 6 }}>
                <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{result.file}</Text>
                <Text fontSize={10} color={COLORS.textDim}>:{result.line}</Text>
                <Box style={{ flexGrow: 1 }} />
                <Pill label={String(result.matches)} color={COLORS.blue} tiny={true} />
              </Row>
              <Text fontSize={10} color={COLORS.text}>{result.text}</Text>
            </Pressable>
          ))}
        </Col>
      </ScrollView>
      {!minimumBand ? (
        <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textDim}>results in workspace</Text>
          <Pressable onPress={() => props.onQuery(props.query)}><Text fontSize={10} color={COLORS.blue}>Refresh</Text></Pressable>
        </Row>
      ) : null}
    </Col>
  );
}

function ToolCallCard(props: any) {
  const execItem = props.exec;
  const statusColor = execItem.status === 'completed' ? COLORS.green : execItem.status === 'error' ? COLORS.red : COLORS.blue;
  return (
    <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt, gap: 6 }}>
      <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{execItem.name}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{execItem.input}</Text>
        <Pill label={execItem.status} color={statusColor} borderColor={statusColor} backgroundColor={COLORS.panelRaised} tiny={true} />
      </Row>
      <Text fontSize={10} color={COLORS.text}>{execItem.result}</Text>
    </Box>
  );
}

function ChatSurface(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimumBand = props.widthBand === 'minimum';
  const focusLabel = props.currentFilePath === '__landing__' ? props.workspaceName : props.currentFilePath === '__settings__' ? 'Settings' : props.currentFilePath;
  const sendLabel = props.agentMode === 'agent' ? 'Launch' : props.agentMode === 'task' ? 'Run Task' : props.agentMode === 'plan' ? 'Plan' : 'Send';
  const filteredSlash = [
    { cmd: '/fix', desc: 'Fix current file' },
    { cmd: '/review', desc: 'Review recent changes' },
    { cmd: '/plan', desc: 'Plan the next edit' },
    { cmd: '/docs', desc: 'Draft docs' },
    { cmd: '/commit', desc: 'Draft commit message' },
  ].filter((item) => props.currentInput === '/' || item.cmd.startsWith(props.currentInput));

  return (
    <Col style={{ width: props.style?.width || '100%', height: '100%', backgroundColor: COLORS.panelBg, borderLeftWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Agent Console</Text>
          <Pill label={props.selectedModel} color={COLORS.blue} tiny={true} />
        </Row>
        <Row style={{ gap: 8 }}>
          <Pressable onPress={props.onNewConversation}><Text fontSize={10} color={COLORS.blue}>New</Text></Pressable>
          <Pressable onPress={props.onIndex}><Text fontSize={10} color={COLORS.blue}>Index</Text></Pressable>
        </Row>
      </Row>

      <Row style={{ padding: compactBand ? 10 : 12, gap: 8, borderBottomWidth: 1, borderColor: COLORS.borderSoft, flexWrap: 'wrap' }}>
        {props.widthBand !== 'narrow' && props.widthBand !== 'widget' && props.widthBand !== 'minimum' ? <Pill label={'view ' + props.activeView} color={COLORS.textMuted} tiny={true} /> : null}
        <Pill label={'branch ' + props.gitBranch} color={COLORS.green} tiny={true} />
        {props.widthBand !== 'minimum' ? <Pill label={'focus ' + (compactBand && focusLabel.includes('/') ? baseName(focusLabel) : focusLabel)} color={COLORS.blue} tiny={true} /> : null}
        <Pill label={'dirty ' + props.changedCount} color={COLORS.yellow} tiny={true} />
      </Row>

      {props.agentStatusText === 'streaming' || props.agentStatusText === 'executing' || props.activeAgentId ? (
        <Row style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, gap: 8, alignItems: 'center', backgroundColor: COLORS.panelRaised, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: props.agentStatusText === 'streaming' ? COLORS.blue : props.agentStatusText === 'executing' ? COLORS.yellow : COLORS.green }} />
          <Text fontSize={10} color={COLORS.text}>
            {props.agentStatusText === 'streaming' ? 'streaming response' : props.agentStatusText === 'executing' ? 'running tools' : 'background agent active'}
          </Text>
          {props.activeAgentId ? <Pressable onPress={props.onStopAgent}><Text fontSize={10} color={COLORS.red}>Stop</Text></Pressable> : null}
        </Row>
      ) : null}

      <ScrollView style={{ flexGrow: 1, height: '100%', padding: 12 }}>
        <Col style={{ gap: 10 }}>
          {!minimumBand ? (
            <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised }}>
              <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
                {props.workspaceName + ' agent session'}
              </Text>
              <Text fontSize={10} color={COLORS.textDim}>
                {props.gitBranch + ' / ' + props.gitRemote + ' / ' + props.changedCount + ' dirty paths'}
              </Text>
            </Box>
          ) : null}

          {props.messages.map((msg: Message, idx: number) => {
            const isUser = msg.role === 'user';
            return (
              <Col key={msg.role + '_' + idx + '_' + msg.text.slice(0, 16)} style={{ gap: 6 }}>
                <Row style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Glyph icon={isUser ? 'message' : 'bot'} tone={isUser ? COLORS.blue : COLORS.green} backgroundColor={isUser ? '#17345d' : '#143120'} tiny={true} />
                  <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{isUser ? 'You' : 'Agent'}</Text>
                  <Text fontSize={10} color={COLORS.textDim}>{msg.time}</Text>
                  {msg.mode ? <Pill label={msg.mode} color={COLORS.blue} tiny={true} /> : null}
                  {msg.model ? <Pill label={msg.model} color={COLORS.textMuted} tiny={true} /> : null}
                </Row>
                <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: isUser ? '#20324f' : '#1c2531', backgroundColor: isUser ? '#101827' : '#10141c', gap: 8 }}>
                  <Text fontSize={11} color={COLORS.text}>{msg.text}</Text>
                  {msg.attachments && msg.attachments.length > 0 ? (
                    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                      {msg.attachments.map((attachment) => (
                        <Pill key={attachment.id} label={attachment.name} color={COLORS.blue} tiny={true} />
                      ))}
                    </Row>
                  ) : null}
                  {msg.toolSnapshot && msg.toolSnapshot.length > 0 ? (
                    <Col style={{ gap: 8 }}>
                      {msg.toolSnapshot.map((execItem) => <ToolCallCard key={execItem.id} exec={execItem} />)}
                    </Col>
                  ) : null}
                </Box>
              </Col>
            );
          })}

          {props.isGenerating ? (
            <Col style={{ gap: 8 }}>
              {props.toolExecutions.length > 0 ? (
                <Box style={{ gap: 8 }}>
                  <Text fontSize={10} color={COLORS.textDim}>Live tool calls</Text>
                  {props.toolExecutions.map((execItem: ToolExecution) => <ToolCallCard key={execItem.id} exec={execItem} />)}
                </Box>
              ) : null}
              <Row style={{ gap: 8, alignItems: 'center' }}>
                <Glyph icon="bot" tone={COLORS.green} backgroundColor="#143120" tiny={true} />
                <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                  <Text fontSize={10} color={COLORS.textDim}>
                    {props.toolExecutions.some((item: ToolExecution) => item.status === 'running') ? 'running tool chain' : 'thinking'}
                  </Text>
                </Box>
              </Row>
            </Col>
          ) : null}
        </Col>
      </ScrollView>

      <Col style={{ padding: compactBand ? 10 : 12, gap: 8, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {['ask', 'plan', 'task', 'agent'].map((mode) => (
            <Pressable
              key={mode}
              onPress={() => props.onSetMode(mode)}
              style={{
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: props.agentMode === mode ? (mode === 'task' ? COLORS.green : mode === 'agent' ? COLORS.orange : COLORS.blue) : COLORS.border,
                backgroundColor: props.agentMode === mode ? (mode === 'task' ? '#182510' : mode === 'agent' ? '#26180f' : COLORS.blueDeep) : COLORS.panelAlt,
              }}
            >
              <Text fontSize={10} color={props.agentMode === mode ? (mode === 'task' ? COLORS.green : mode === 'agent' ? COLORS.orange : COLORS.blue) : COLORS.text}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </Row>

        {props.currentInput.startsWith('/') && filteredSlash.length > 0 ? (
          <Col style={{ gap: 6 }}>
            {filteredSlash.map((cmd) => (
              <Pressable key={cmd.cmd} onPress={() => props.onSelectSlash(cmd.cmd)} style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                <Row style={{ gap: 8, alignItems: 'center' }}>
                  <Text fontSize={10} color={COLORS.blue} style={{ fontWeight: 'bold' }}>{cmd.cmd}</Text>
                  <Text fontSize={10} color={COLORS.textDim}>{cmd.desc}</Text>
                </Row>
              </Pressable>
            ))}
          </Col>
        ) : null}

        <Box style={{ padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Text fontSize={10} color={COLORS.textBright}>{focusLabel}</Text>
            {props.widthBand !== 'minimum' ? <Text fontSize={10} color={COLORS.textDim}>{props.gitBranch + ' / ' + props.gitRemote}</Text> : null}
          </Row>

          {props.attachments.length > 0 ? (
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {props.attachments.map((attachment: any) => (
                <Row key={attachment.id} style={{ alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelAlt }}>
                  <Text fontSize={10} color={COLORS.blue}>{attachment.name}</Text>
                  <Pressable onPress={() => props.onRemoveAttachment(attachment.id)}><Text fontSize={10} color={COLORS.textDim}>X</Text></Pressable>
                </Row>
              ))}
              <Pressable onPress={props.onClearAttachments}><Text fontSize={10} color={COLORS.red}>Clear</Text></Pressable>
            </Row>
          ) : null}

          <TextArea
            value={props.currentInput}
            onChange={props.onInputChange}
            fontSize={11}
            color={COLORS.text}
            style={{ height: 84, borderWidth: 0, backgroundColor: 'transparent' }}
          />

          <Row style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pressable onPress={props.onAttachCurrentFile}><Text fontSize={10} color={COLORS.blue}>File</Text></Pressable>
              <Pressable onPress={props.onAttachSymbol}><Text fontSize={10} color={COLORS.blue}>Symbol</Text></Pressable>
              <Pressable onPress={props.onAttachGit}><Text fontSize={10} color={COLORS.blue}>Git</Text></Pressable>
              <Pressable onPress={props.onToggleWebSearch}><Text fontSize={10} color={props.webSearch ? COLORS.blue : COLORS.textDim}>Web</Text></Pressable>
              <Pressable onPress={props.onToggleTermAccess}><Text fontSize={10} color={props.termAccess ? COLORS.blue : COLORS.textDim}>Term</Text></Pressable>
              <Pressable onPress={props.onToggleAutoApply}><Text fontSize={10} color={props.autoApply ? COLORS.blue : COLORS.textDim}>Auto</Text></Pressable>
            </Row>
            <Row style={{ gap: 8, alignItems: 'center' }}>
              {props.inputTokenEstimate > 0 ? <Text fontSize={10} color={props.inputTokenEstimate > 16000 ? COLORS.red : props.inputTokenEstimate > 8000 ? COLORS.yellow : COLORS.textDim}>{props.inputTokenEstimate + ' tkns'}</Text> : null}
              <Pressable onPress={props.onCycleModel}><Text fontSize={10} color={COLORS.text}>{props.modelDisplayName}</Text></Pressable>
              <Pressable onPress={props.onSend} style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, borderRadius: 10, backgroundColor: COLORS.blueDeep, borderWidth: 1, borderColor: COLORS.blue }}>
                <Text fontSize={10} color={COLORS.blue}>{sendLabel}</Text>
              </Pressable>
            </Row>
          </Row>
        </Box>

        {props.agentMode === 'task' ? <Text fontSize={10} color={COLORS.yellow}>Task mode can read the workspace, inspect git, and use the terminal.</Text> : null}
        {props.agentMode === 'plan' ? <Text fontSize={10} color={COLORS.blue}>Plan mode stays descriptive first, edit second.</Text> : null}
      </Col>
    </Col>
  );
}

function SettingsRow(props: any) {
  const active = props.active === 1;
  return (
    <Pressable
      onPress={() => props.onSelect(props.section.id)}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? props.section.tone : COLORS.border,
        backgroundColor: active ? COLORS.panelHover : COLORS.panelRaised,
        gap: 4,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Glyph icon={props.section.icon === 'globe' ? 'globe' : props.section.icon === 'folder' ? 'folder' : props.section.icon === 'bot' ? 'bot' : props.section.icon === 'sparkles' ? 'sparkles' : props.section.icon === 'braces' ? 'braces' : 'palette'} tone={props.section.tone} backgroundColor="transparent" tiny={true} />
        <Text fontSize={12} color={active ? COLORS.textBright : COLORS.text} style={{ fontWeight: 'bold' }}>{props.section.label}</Text>
        <Box style={{ flexGrow: 1 }} />
        <Text fontSize={10} color={props.section.tone}>{props.section.count}</Text>
      </Row>
      <Text fontSize={10} color={COLORS.textDim}>{props.section.meta}</Text>
    </Pressable>
  );
}

function InfoCard(props: any) {
  const item = props.item;
  return (
    <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
      <Row style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
        <Pill label={item.owner || item.backend || item.runtime || item.status} color={item.tone} tiny={true} />
        {item.scope ? <Pill label={item.scope} color={COLORS.blue} tiny={true} /> : null}
        {item.retention ? <Pill label={item.retention} color={COLORS.purple} tiny={true} /> : null}
      </Row>
      {item.source ? <Text fontSize={10} color={COLORS.textDim}>{item.source}</Text> : null}
      {item.summary ? <Text fontSize={11} color={COLORS.text}>{item.summary}</Text> : null}
      {item.stress ? <Text fontSize={10} color={COLORS.orange}>stress: {item.stress}</Text> : null}
      {item.output ? <Text fontSize={10} color={COLORS.blue}>output: {item.output}</Text> : null}
      {item.risk ? <Text fontSize={10} color={COLORS.red}>risk: {item.risk}</Text> : null}
    </Box>
  );
}

function ProviderCard(props: any) {
  const provider = props.provider;
  const active = props.active === 1;
  return (
    <Pressable
      onPress={() => props.onSelect(provider.id)}
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? provider.tone : COLORS.border,
        backgroundColor: active ? COLORS.panelHover : COLORS.panelRaised,
        gap: 8,
      }}
    >
      <Row style={{ alignItems: 'center', gap: 8 }}>
        <Pill label={provider.short} color={provider.tone} borderColor={provider.tone} backgroundColor={COLORS.panelBg} tiny={true} />
        <Col style={{ gap: 2, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{provider.name}</Text>
          <Text fontSize={10} color={COLORS.textDim}>{provider.driver}</Text>
        </Col>
        <Pill label={provider.status} color={provider.tone} borderColor={provider.tone} backgroundColor={COLORS.panelBg} tiny={true} />
      </Row>
      <Row style={{ gap: 6, flexWrap: 'wrap' }}>
        <Pill label={provider.route} tiny={true} />
        <Pill label={provider.defaultModel} color={COLORS.blue} tiny={true} />
        <Pill label={provider.env} color={COLORS.green} tiny={true} />
      </Row>
      <Text fontSize={11} color={COLORS.text}>{provider.summary}</Text>
    </Pressable>
  );
}

function CapabilityCard(props: any) {
  const item = props.item;
  return (
    <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 8 }}>
      <Row style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{item.name}</Text>
        <Pill label={item.status} color={item.tone} borderColor={item.tone} backgroundColor={COLORS.panelBg} tiny={true} />
        <Pill label={item.surface} tiny={true} />
      </Row>
      <Text fontSize={11} color={COLORS.text}>{item.summary}</Text>
      <Text fontSize={10} color={COLORS.blue}>reference: {item.reference}</Text>
      <Text fontSize={10} color={COLORS.orange}>pressure: {item.pressure}</Text>
    </Box>
  );
}

function SettingsSurface(props: any) {
  const stacked = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const selectedProvider = props.providers.find((provider: any) => provider.id === props.selectedProviderId) || props.providers[0];
  return (
    <ScrollView style={{ flexGrow: 1, height: '100%', backgroundColor: COLORS.panelBg }}>
      <Col style={{ padding: stacked ? 12 : 18, gap: 16 }}>
        <Box style={{ padding: stacked ? 14 : 18, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 10 }}>
          <Text fontSize={10} color={COLORS.blue} style={{ letterSpacing: 0.8, fontWeight: 'bold' }}>SETTINGS SURFACE</Text>
          <Text fontSize={stacked ? 20 : 24} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
            Provider routing, context layers, memory, and plugin runtimes
          </Text>
          <Text fontSize={11} color={COLORS.text}>
            This page is deliberately product-dense. It pulls runtime pressure into one surface instead of scattering it across toy carts.
          </Text>
          <Row style={{ gap: 8, flexWrap: 'wrap' }}>
            <Pill label="model" color={COLORS.red} borderColor="#5a1f24" backgroundColor="#181015" />
            <Pill label={props.selectedModelName} color={COLORS.red} borderColor="#5a1f24" backgroundColor="#181015" />
            <Pill label={props.workspaceName} color={COLORS.blue} />
            <Pill label={props.gitBranch} color={COLORS.green} />
            <Pill label={props.agentStatusText} color={COLORS.purple} />
            <Pill label={props.workDir} color={COLORS.textMuted} />
          </Row>
        </Box>

        <Box style={{ flexDirection: stacked ? 'column' : 'row', gap: 14, alignItems: 'flex-start' }}>
          <Col style={{ width: stacked ? '100%' : 240, gap: 10 }}>
            {props.sections.map((section: any) => (
              <SettingsRow key={section.id} section={section} active={section.id === props.activeSection ? 1 : 0} onSelect={props.onSelectSection} />
            ))}
            <Box style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 6 }}>
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Compiler Goals</Text>
              <Text fontSize={10} color={COLORS.textDim}>Each area is intended to either compile as a real product slice or fail loudly enough to reduce into conformance work.</Text>
              <Pill label="vertical slice first" color={COLORS.blue} tiny={true} />
              <Pill label="runtime harness before workarounds" color={COLORS.green} tiny={true} />
              <Pill label="compiler break is success" color={COLORS.orange} tiny={true} />
            </Box>
          </Col>

          <Col style={{ flexGrow: 1, flexBasis: 0, gap: 14 }}>
            {props.activeSection === 'providers' ? (
              <Col style={{ gap: 14 }}>
                <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelRaised, gap: 12 }}>
                  <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Model Providers</Text>
                  <Text fontSize={10} color={COLORS.textDim}>Real routing, auth, and policy surfaces instead of one hard-coded picker.</Text>
                  <Col style={{ gap: 10 }}>
                    {props.providers.map((provider: any) => (
                      <ProviderCard key={provider.id} provider={provider} active={provider.id === props.selectedProviderId ? 1 : 0} onSelect={props.onSelectProvider} />
                    ))}
                  </Col>
                </Box>
                <Box style={{ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: selectedProvider.tone, backgroundColor: COLORS.panelRaised, gap: 12 }}>
                  <Text fontSize={13} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>{selectedProvider.name + ' Routing'}</Text>
                  <Text fontSize={10} color={COLORS.text}>{selectedProvider.summary}</Text>
                  <Row style={{ gap: 8, flexWrap: 'wrap' }}>
                    {selectedProvider.capabilities.map((capability: string) => (
                      <Pill key={capability} label={capability} color={selectedProvider.tone} borderColor={selectedProvider.tone} backgroundColor={COLORS.panelBg} tiny={true} />
                    ))}
                  </Row>
                  <Box style={{ flexDirection: stacked ? 'column' : 'row', gap: 10 }}>
                    <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Default route</Text>
                      <Text fontSize={10} color={COLORS.blue}>{selectedProvider.route}</Text>
                      <Text fontSize={10} color={COLORS.textDim}>{selectedProvider.env}</Text>
                    </Col>
                    <Col style={{ gap: 6, flexGrow: 1, flexBasis: 0, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
                      <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Compiler pressure</Text>
                      <Text fontSize={10} color={COLORS.orange}>{selectedProvider.pressure}</Text>
                      <Text fontSize={10} color={COLORS.textDim}>{selectedProvider.detail}</Text>
                    </Col>
                  </Box>
                </Box>
              </Col>
            ) : null}

            {props.activeSection === 'context' ? <Col style={{ gap: 10 }}>{props.contextRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'memory' ? <Col style={{ gap: 10 }}>{props.memoryRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'plugins' ? <Col style={{ gap: 10 }}>{props.pluginRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'automations' ? <Col style={{ gap: 10 }}>{props.automationRows.map((item: any) => <InfoCard key={item.name} item={item} />)}</Col> : null}
            {props.activeSection === 'capabilities' ? <Col style={{ gap: 10 }}>{props.capabilityRows.map((item: any) => <CapabilityCard key={item.name} item={item} />)}</Col> : null}
          </Col>
        </Box>
      </Col>
    </ScrollView>
  );
}

function TerminalPanel(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  return (
    <Col style={{ backgroundColor: COLORS.panelBg, borderTopWidth: 1, borderColor: COLORS.borderSoft, height: props.height || '100%' }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'center', padding: compactBand ? 10 : 12, borderBottomWidth: 1, borderColor: COLORS.borderSoft }}>
        <Row style={{ gap: 8, alignItems: 'center' }}>
          <Text fontSize={12} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Terminal</Text>
          <Pill label={props.gitBranch} color={COLORS.green} tiny={true} />
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.workDir}</Text> : null}
        </Row>
        {props.onClose ? <Pressable onPress={props.onClose}><Text fontSize={10} color={COLORS.textDim}>X</Text></Pressable> : null}
      </Row>
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, backgroundColor: '#0b0f15' }}>
        <Native type="Terminal" style={{ width: '100%', height: '100%' }} fontSize={compactBand ? 12 : 13} />
      </Box>
      {!compactBand ? (
        <Box style={{ padding: 10, borderTopWidth: 1, borderColor: COLORS.borderSoft }}>
          <Text fontSize={10} color={COLORS.textDim}>pty attached to workspace shell</Text>
        </Box>
      ) : null}
    </Col>
  );
}

function StatusBar(props: any) {
  const compactBand = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const mediumBand = props.widthBand === 'medium';
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, backgroundColor: COLORS.panelAlt, borderTopWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Row style={{ gap: 6, alignItems: 'center' }}>
          <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green }} />
          <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
          {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{props.gitRemote}</Text> : null}
        </Row>
        <Text fontSize={10} color={COLORS.textDim}>{'dirty ' + props.changedCount}</Text>
        {!mediumBand ? <Text fontSize={10} color={COLORS.textDim}>{'staged ' + props.stagedCount}</Text> : null}
        {!compactBand ? <Text fontSize={10} color={COLORS.textDim}>{'+' + props.branchAhead + ' / -' + props.branchBehind}</Text> : null}
        <Text fontSize={10} color={COLORS.textDim}>{'Ln ' + props.cursorLine}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{'Col ' + props.cursorColumn}</Text>
      </Row>
      <Row style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!mediumBand ? <Text fontSize={10} color={COLORS.textDim}>{props.fileName === '__landing__' ? props.workDir : props.fileName === '__settings__' ? 'Settings' : props.fileName}</Text> : null}
        <Text fontSize={10} color={COLORS.textDim}>{props.languageMode}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.selectedModel}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.agentStatusText}</Text>
      </Row>
    </Row>
  );
}

export default function CursorIdeApp() {
  const [activeTabId, setActiveTabId] = useState('home');
  const [currentInput, setCurrentInputState] = useState('');
  const [isGenerating, setIsGenerating] = useState(0);
  // TODO: re-implement cursor Ln/Col readout via a polling hook that reads
  // getCursorPos() from the framework on an interval. The old push-based
  // onCursorChange path was removed because it collapsed FPS during drag-select.
  const cursorPosition = { line: 1, column: 1 };
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeAgentId, setActiveAgentId] = useState('');
  const [agentStatusText, setAgentStatusText] = useState('idle');
  const [workDir, setWorkDir] = useState('.');
  const [workspaceName, setWorkspaceName] = useState('reactjit');
  const [workspaceTagline, setWorkspaceTagline] = useState('Native agent workspace');
  const [workspaceStats, setWorkspaceStats] = useState([
    { label: 'indexed', value: '0', tone: '#2d62ff' },
    { label: 'dirty', value: '0', tone: COLORS.yellow },
    { label: 'tabs', value: '1', tone: COLORS.green },
    { label: 'agent', value: 'idle', tone: COLORS.purple },
  ]);
  const [landingProjects, setLandingProjects] = useState<any[]>([
    { name: 'reactjit', path: '__landing__', displayPath: 'Project landing', summary: 'Live workspace overview', badge: 'workspace', accent: '#2d62ff' },
  ]);
  const [landingRecentFiles, setLandingRecentFiles] = useState<any[]>([]);
  const [gitConnections, setGitConnections] = useState<any[]>([]);
  const [gitChanges, setGitChanges] = useState<any[]>([]);
  const [gitRemote, setGitRemote] = useState('origin');
  const [branchAhead, setBranchAhead] = useState(0);
  const [branchBehind, setBranchBehind] = useState(0);
  const [changedCount, setChangedCount] = useState(0);
  const [stagedCount, setStagedCount] = useState(0);
  const [activeView, setActiveView] = useState('landing');
  const [windowWidth, setWindowWidth] = useState(1280);
  const [windowHeight, setWindowHeight] = useState(800);
  const [widthBand, setWidthBand] = useState<WidthBand>('desktop');
  const [compactSurface, setCompactSurface] = useState('landing');
  const [showChat, setShowChat] = useState(1);
  const [showTerminal, setShowTerminal] = useState(0);
  const [showSearch, setShowSearch] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([
    { name: 'reactjit', type: 'workspace', indent: 0, expanded: 1, selected: 1, visible: 1, git: '', hot: 1, path: '.' },
  ]);
  // editorContent state is the *committed* text used as the TextEditor's `value`
  // prop. It is updated ONLY on file-load and save — never on keystroke. This
  // keeps the value prop identity-stable across typing-driven re-renders so
  // the reconciler never emits a 1.6 MB UPDATE op per character. The live
  // buffer during typing is held by the framework (input.zig) and mirrored
  // into editorContentRef for save() to read.
  const [editorContent, setEditorContent] = useState('');
  const editorContentRef = useRef('');
  // Debounce the syntax-highlight rebuild — running regex over 143 KB of
  // source on every keystroke OOMs the QJS regex engine.
  const rebuildTimerRef = useRef<any>(null);
  const [editorModified, setEditorModified] = useState(0);
  const [currentFilePath, setCurrentFilePath] = useState('__landing__');
  const [editorRows, setEditorRows] = useState<any[]>([]);
  const [editorColorRows, setEditorColorRows] = useState<any[] | null>(null);
  const [totalLines, setTotalLines] = useState(0);
  const [editorLargeFileMode, setEditorLargeFileMode] = useState(0);
  const [settingsSection, setSettingsSection] = useState('providers');
  const [selectedProviderId, setSelectedProviderId] = useState('anthropic');
  const [openTabs, setOpenTabs] = useState<Tab[]>([
    { id: 'home', name: 'Projects', path: '__landing__', type: 'home', modified: 0, pinned: 1, git: '' },
  ]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedModel, setSelectedModel] = useState('claude-opus-4');
  const [modelDisplayName, setModelDisplayName] = useState('Opus 4');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitStatus, setGitStatus] = useState('');
  const [errors] = useState(0);
  const [warnings] = useState(0);
  const [languageMode, setLanguageMode] = useState('Workspace');
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
    { label: 'reactjit', icon: 'package', tone: COLORS.green, active: 1, kind: 'workspace', meta: 'workspace' },
  ]);
  const [agentMode, setAgentModeState] = useState('ask');
  const [attachments, setAttachmentsState] = useState<Array<{ id: string; type: string; name: string; path: string }>>([]);
  const [webSearch, setWebSearchState] = useState(0);
  const [termAccess, setTermAccessState] = useState(0);
  const [autoApply, setAutoApplyState] = useState(0);
  const [inputTokenEstimate, setInputTokenEstimateState] = useState(0);

  const fileContentsRef = useRef<Record<string, string>>({});
  const gitStatusByPathRef = useRef<Record<string, string>>({});
  const cachedTreePathsRef = useRef<string[]>([]);
  const workspaceBootstrappedRef = useRef(false);
  const ptyStartedRef = useRef(false);
  const stateRef = useRef<any>({});

  // ── Exec cache ─────────────────────────────────────────────────────────
  // exec() is a synchronous popen+fread against the main JS thread. Each
  // invocation blocks rendering, timers, and the watchdog heartbeat. The
  // workspace scan (`find | sed | head`) plus the git setup commands (remote,
  // worktree, branch) together block for seconds on this repo, so calling
  // refreshWorkspace() on every save/new-file/click freezes the app long
  // enough for the watchdog to kill it mid-interaction. These commands'
  // output is effectively constant across a session, so memoize them and
  // only run the genuinely dynamic ones (git status, rev-list counts) live.
  // clearExecCache() drops the cache when a user action actually changes the
  // snapshot (explicit reindex, new file creation).
  const execCacheRef = useRef<Record<string, string>>({});
  function execCached(cmd: string): string {
    const cache = execCacheRef.current;
    if (cache[cmd] !== undefined) return cache[cmd];
    const result = exec(cmd);
    cache[cmd] = result;
    return result;
  }
  function clearExecCache(): void {
    execCacheRef.current = {};
  }
  stateRef.current = {
    activeTabId,
    activeAgentId,
    activeView,
    attachments,
    agentMode,
    agentStatusText,
    changedCount,
    chatMessages,
    compactSurface,
    currentFilePath,
    currentInput,
    editorContent,
    files,
    gitBranch,
    gitRemote,
    modelDisplayName,
    openTabs,
    searchQuery,
    selectedModel,
    stagedCount,
    workDir,
    widthBand,
    windowHeight,
    windowWidth,
    workspaceName,
    showSearch,
    showChat,
    showTerminal,
  };

  function addToolExecution(id: string, name: string, input: string) {
    setToolExecutions((prev) => [...prev, { id, name, input, status: 'running', percent: 20, result: '' }]);
  }

  function completeToolExecution(id: string, result: string) {
    setToolExecutions((prev) => prev.map((item) => item.id === id ? { ...item, status: 'completed', percent: 100, result } : item));
  }

  function failToolExecution(id: string, result: string) {
    setToolExecutions((prev) => prev.map((item) => item.id === id ? { ...item, status: 'error', percent: 0, result } : item));
  }

  function replaceComposer(nextText: string, nextAttachments?: Array<{ id: string; type: string; name: string; path: string }>) {
    const attachmentList = nextAttachments ?? stateRef.current.attachments;
    setCurrentInputState(nextText);
    setInputTokenEstimateState(estimateTokens(nextText, attachmentList));
  }

  function replaceAttachments(nextAttachments: Array<{ id: string; type: string; name: string; path: string }>) {
    setAttachmentsState(nextAttachments);
    setInputTokenEstimateState(estimateTokens(stateRef.current.currentInput, nextAttachments));
  }

  function syncWindowMetrics() {
    const sys = telSystem();
    if (!sys) return;
    const w = sys.window_w || stateRef.current.windowWidth || 1280;
    const h = sys.window_h || stateRef.current.windowHeight || 800;
    const band = widthBandForSize(w, h);
    const mainSurface = primaryMainView(stateRef.current.activeView, stateRef.current.currentFilePath);
    if (w !== stateRef.current.windowWidth) setWindowWidth(w);
    if (h !== stateRef.current.windowHeight) setWindowHeight(h);
    if (band !== stateRef.current.widthBand) setWidthBand(band);

    if (band === 'narrow' || band === 'widget' || band === 'minimum') {
      let nextSurface = stateRef.current.compactSurface || mainSurface;
      if (nextSurface === 'editor' && mainSurface === 'landing') nextSurface = 'landing';
      if (nextSurface === 'landing' && mainSurface === 'editor') nextSurface = 'editor';
      if ((nextSurface === 'landing' || nextSurface === 'editor' || nextSurface === 'settings') && mainSurface === 'settings') nextSurface = 'settings';
      if (nextSurface === 'settings' && mainSurface !== 'settings') nextSurface = mainSurface;
      if (nextSurface !== stateRef.current.compactSurface) setCompactSurface(nextSurface);
    } else if (
      (stateRef.current.compactSurface === 'landing' || stateRef.current.compactSurface === 'editor' || stateRef.current.compactSurface === 'settings') &&
      stateRef.current.compactSurface !== mainSurface
    ) {
      setCompactSurface(mainSurface);
    }
  }

  function pathPriority(path: string): number {
    if (path.indexOf('cart/cursor-ide') === 0) return 0;
    if (path.indexOf('tsz/carts/conformance/mixed/cursor-ide') === 0) return 1;
    if (path.indexOf('runtime/') === 0) return 2;
    if (path.indexOf('renderer/') === 0) return 3;
    if (path === 'qjs_app.zig') return 4;
    return 5;
  }

  function shouldKeepPath(path: string): boolean {
    if (!path) return false;
    if (path.indexOf('.git/') === 0) return false;
    if (path.indexOf('zig-cache/') === 0) return false;
    if (path.indexOf('zig-out/') === 0) return false;
    if (path.indexOf('node_modules/') === 0) return false;
    if (path.indexOf('archive/') === 0) return false;
    if (path.indexOf('love2d/') === 0) return false;
    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg')) return false;
    return true;
  }

  function hasPath(list: string[], path: string): boolean {
    return list.some((item) => samePath(item, path));
  }

  function dirGitStatus(path: string): string {
    for (const key of Object.keys(gitStatusByPathRef.current)) {
      if (key.indexOf(path + '/') === 0) return 'dirty';
    }
    return '';
  }

  function isHotPath(path: string): boolean {
    return path.indexOf('cursor-ide') >= 0 || path.indexOf('runtime/') === 0 || path === 'qjs_app.zig';
  }

  function shouldExpand(path: string): number {
    return (
      path === 'cart' ||
      path === 'cart/cursor-ide' ||
      path === 'runtime' ||
      path === 'renderer' ||
      path === 'tsz' ||
      path === 'tsz/carts' ||
      path === 'tsz/carts/conformance' ||
      path === 'tsz/carts/conformance/mixed' ||
      path === 'tsz/carts/conformance/mixed/cursor-ide'
    ) ? 1 : 0;
  }

  function findTreeItem(list: FileItem[], path: string): FileItem | null {
    return list.find((item) => samePath(item.path, path)) || null;
  }

  function applyTreeVisibility(list: FileItem[]): FileItem[] {
    return list.map((item) => {
      if (item.type === 'workspace') return { ...item, visible: 1 };
      let visible = 1;
      let parent = parentPath(item.path);
      while (parent !== '.' && parent.length > 0) {
        const parentItem = findTreeItem(list, parent);
        if (parentItem && parentItem.expanded !== 1) visible = 0;
        parent = parentPath(parent);
      }
      return { ...item, visible };
    });
  }

  function flattenTreeNode(node: any, depth: number, items: FileItem[]) {
    const dirNames = Object.keys(node.dirs).sort();
    for (const dirName of dirNames) {
      const dir = node.dirs[dirName];
      items.push({
        name: dir.name,
        type: 'dir',
        indent: depth + 1,
        expanded: shouldExpand(dir.path),
        selected: 0,
        visible: 1,
        git: dirGitStatus(dir.path),
        hot: isHotPath(dir.path) ? 1 : 0,
        path: dir.path,
      });
      flattenTreeNode(dir, depth + 1, items);
    }

    node.files.sort((a: any, b: any) => {
      const pa = pathPriority(a.path);
      const pb = pathPriority(b.path);
      if (pa !== pb) return pa - pb;
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });

    for (const file of node.files) {
      items.push({
        name: file.name,
        type: file.type,
        indent: depth + 1,
        expanded: 0,
        selected: samePath(file.path, stateRef.current.currentFilePath) ? 1 : 0,
        visible: 1,
        git: gitStatusByPathRef.current[file.path] || '',
        hot: isHotPath(file.path) ? 1 : 0,
        path: file.path,
      });
    }
  }

  function buildWorkspaceSnapshot(rootName: string) {
    const raw = execCached('find . -maxdepth 5 \\( -path "./.git" -o -path "./zig-cache" -o -path "./zig-out" -o -path "./node_modules" -o -path "./archive" -o -path "./love2d" \\) -prune -o -type f -print 2>/dev/null | sed -n "1,180{s#^\\./##;p;}"');
    const discovered = trimLines(raw);
    const merged: string[] = [];
    for (const path of focusPaths()) {
      if (shouldKeepPath(path) && !hasPath(merged, path)) merged.push(path);
    }
    for (const path of discovered) {
      if (shouldKeepPath(path) && !hasPath(merged, path)) merged.push(path);
    }
    merged.sort((a, b) => {
      const pa = pathPriority(a);
      const pb = pathPriority(b);
      if (pa !== pb) return pa - pb;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    cachedTreePathsRef.current = merged;

    const tree = { name: rootName, path: '.', dirs: {} as Record<string, any>, files: [] as any[] };
    for (const path of merged) {
      const parts = path.split('/');
      let node = tree;
      let current = '';
      for (let idx = 0; idx < parts.length; idx += 1) {
        const part = parts[idx];
        if (idx === parts.length - 1) {
          node.files.push({ name: part, path, type: inferFileType(path) });
        } else {
          current = current.length === 0 ? part : current + '/' + part;
          if (!node.dirs[part]) node.dirs[part] = { name: part, path: current, dirs: {}, files: [] };
          node = node.dirs[part];
        }
      }
    }

    const items: FileItem[] = [
      { name: rootName, type: 'workspace', indent: 0, expanded: 1, selected: stateRef.current.activeView === 'landing' ? 1 : 0, visible: 1, git: '', hot: 1, path: '.' },
    ];
    flattenTreeNode(tree, 0, items);
    return { items: applyTreeVisibility(items), paths: merged };
  }

  function markSelectedPath(path: string) {
    setFiles((prev) => prev.map((item) => ({
      ...item,
      selected: path === '__landing__' ? (item.type === 'workspace' ? 1 : 0) : (samePath(item.path, path) ? 1 : 0),
    })));
  }

  function buildLandingProjects(paths: string[], info: any, nextWorkspaceName: string) {
    const projects: any[] = [
      {
        name: nextWorkspaceName,
        path: '__landing__',
        displayPath: 'Project landing',
        summary: 'Branch ' + info.branch + ' with ' + info.dirty + ' dirty paths and ' + paths.length + ' indexed files.',
        badge: 'workspace',
        accent: '#2d62ff',
      },
      {
        name: 'cursor-ide TSX cart',
        path: 'cart/cursor-ide/index.tsx',
        displayPath: 'cart/cursor-ide/index.tsx',
        summary: 'Runtime-native port of the mixed-lane Cursor IDE shell for the active ReactJIT stack.',
        badge: 'active',
        accent: COLORS.green,
      },
      {
        name: 'legacy TSZ reference',
        path: 'tsz/carts/conformance/mixed/cursor-ide/cursor-ide.tsz',
        displayPath: 'tsz/carts/conformance/mixed/cursor-ide/cursor-ide.tsz',
        summary: 'Frozen Smith-era source that the current cart mirrors surface-for-surface.',
        badge: 'reference',
        accent: COLORS.purple,
      },
      {
        name: 'settings surface',
        path: '__settings__',
        displayPath: 'Settings',
        summary: 'Provider routing, context layering, memory orchestration, plugin runtimes, and capability references in one dense shell.',
        badge: 'surface',
        accent: COLORS.orange,
      },
    ];
    if (hasPath(paths, 'runtime/primitives.tsx')) {
      projects.push({
        name: 'runtime primitives',
        path: 'runtime/primitives.tsx',
        displayPath: 'runtime/primitives.tsx',
        summary: 'Current primitive surface map for Box/Text/Terminal/Native nodes.',
        badge: 'runtime',
        accent: COLORS.blue,
      });
    }
    setLandingProjects(projects);
  }

  function buildLandingRecentFiles(paths: string[], info: any) {
    const recent: any[] = [];
    const seen: Record<string, number> = {};
    function pushRecent(path: string, label: string, reason: string) {
      const clean = stripDotSlash(path);
      if (!clean || seen[clean]) return;
      seen[clean] = 1;
      const type = inferFileType(clean);
      recent.push({
        path: clean,
        displayPath: clean === '__landing__' ? 'Project landing' : clean === '__settings__' ? 'Settings' : clean,
        label,
        reason,
        icon: fileGlyph(type),
        tone: fileTone(type),
      });
    }
    for (let i = 0; i < info.changes.length && recent.length < 4; i += 1) pushRecent(info.changes[i].path, baseName(info.changes[i].path), info.changes[i].status);
    for (let i = 0; i < stateRef.current.openTabs.length && recent.length < 6; i += 1) {
      const tab = stateRef.current.openTabs[i];
      if (tab.path !== '__landing__') pushRecent(tab.path, tab.name, 'open tab');
    }
    for (let i = 0; i < paths.length && recent.length < 8; i += 1) {
      if (paths[i].indexOf('cursor-ide') >= 0) pushRecent(paths[i], baseName(paths[i]), 'focus surface');
    }
    setLandingRecentFiles(recent);
  }

  function buildBreadcrumbs(path: string, workspaceNameOverride?: string, gitBranchOverride?: string) {
    const nextWorkspaceName = workspaceNameOverride || stateRef.current.workspaceName;
    const nextGitBranch = gitBranchOverride || stateRef.current.gitBranch;
    if (path === '__landing__') {
      setBreadcrumbs([
        { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
        { label: nextWorkspaceName, icon: 'package', tone: COLORS.green, active: 1, kind: 'workspace', meta: nextGitBranch },
      ]);
      return;
    }
    if (path === '__settings__') {
      setBreadcrumbs([
        { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
        { label: nextWorkspaceName, icon: 'package', tone: COLORS.green, active: 0, kind: 'workspace', meta: nextGitBranch },
        { label: 'Settings', icon: 'palette', tone: COLORS.purple, active: 1, kind: 'settings', meta: 'providers / memory' },
      ]);
      return;
    }
    const crumbs: Breadcrumb[] = [
      { label: 'Projects', icon: 'house', tone: '#2d62ff', active: 0, kind: 'home' },
      { label: nextWorkspaceName, icon: 'package', tone: COLORS.green, active: 0, kind: 'workspace', meta: nextGitBranch },
    ];
    let current = '';
    for (const [idx, part] of path.split('/').entries()) {
      current = current.length === 0 ? part : current + '/' + part;
      const isLast = idx === path.split('/').length - 1;
      const type = isLast ? inferFileType(current) : 'dir';
      crumbs.push({
        label: part,
        icon: fileGlyph(type),
        tone: fileTone(type),
        active: isLast ? 1 : 0,
        kind: type,
        meta: isLast && gitStatusByPathRef.current[path] ? gitStatusByPathRef.current[path] : '',
      });
    }
    setBreadcrumbs(crumbs);
  }

  function loadGitSummary() {
    let branch = execCached('git branch --show-current 2>/dev/null').replace(/\s+/g, '');
    if (!branch) branch = 'detached';
    setGitBranch(branch);

    let remoteName = 'origin';
    const connections: any[] = [];
    const seenRemote: Record<string, number> = {};
    const remoteLines = trimLines(execCached('git remote -v 2>/dev/null | sed -n "1,6p"'));
    for (const line of remoteLines) {
      let tab = line.indexOf('\t');
      if (tab < 0) tab = line.indexOf(' ');
      if (tab < 0) continue;
      const name = line.slice(0, tab);
      let rest = line.slice(tab + 1);
      const modeIdx = rest.indexOf(' ');
      if (modeIdx >= 0) rest = rest.slice(0, modeIdx);
      if (seenRemote[name] !== 1) {
        connections.push({ name, detail: rest, kind: 'remote', tone: '#2d62ff' });
        seenRemote[name] = 1;
        if (connections.length === 1) remoteName = name;
      }
    }
    setGitRemote(remoteName);

    const worktreeLines = trimLines(execCached('git worktree list 2>/dev/null | sed -n "1,3p"'));
    for (const line of worktreeLines) connections.push({ name: 'worktree', detail: line, kind: 'worktree', tone: COLORS.green });

    let ahead = 0;
    let behind = 0;
    const counts = exec('git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null').trim();
    if (counts) {
      const parts = counts.includes('\t') ? counts.split('\t') : counts.split(' ');
      if (parts.length >= 2) {
        behind = parseInt(parts[0], 10) || 0;
        ahead = parseInt(parts[1], 10) || 0;
      }
    }
    setBranchAhead(ahead);
    setBranchBehind(behind);
    connections.unshift({ name: branch, detail: 'ahead ' + ahead + ' / behind ' + behind, kind: 'branch', tone: COLORS.green });

    const statusLines = trimLines(exec('git status --short 2>/dev/null'));
    const changes: any[] = [];
    let dirty = 0;
    let staged = 0;
    gitStatusByPathRef.current = {};
    for (const statusLine of statusLines) {
      if (statusLine.length < 3) continue;
      const code = statusLine.slice(0, 2);
      let path = statusLine.slice(3);
      const rename = path.indexOf(' -> ');
      if (rename >= 0) path = path.slice(rename + 4);
      path = stripDotSlash(path);
      dirty += 1;
      if (code.charAt(0) !== ' ' && code.charAt(0) !== '?') staged += 1;
      gitStatusByPathRef.current[path] = code.replace(/\s+/g, '');
      changes.push({ path, status: statusLabel(code), short: code.replace(/\s+/g, ''), tone: statusTone(code) });
    }
    setGitConnections(connections);
    setGitChanges(changes);
    setChangedCount(dirty);
    setStagedCount(staged);
    setGitStatus(dirty > 0 ? '*' + dirty : '');
    return { branch, dirty, staged, remote: remoteName, ahead, behind, changes, connections };
  }

  function refreshWorkspace() {
    syncWindowMetrics();
    let pwd = execCached('pwd 2>/dev/null').trim();
    if (!pwd) pwd = '.';
    const nextWorkspaceName = baseName(pwd) || 'workspace';
    setWorkDir(pwd);
    setWorkspaceName(nextWorkspaceName);
    setWorkspaceTagline('Conformance-grade IDE cart with live explorer, git, and agent context');

    const gitInfo = loadGitSummary();
    const snapshot = buildWorkspaceSnapshot(nextWorkspaceName);
    setFiles(snapshot.items);
    setWorkspaceStats([
      { label: 'indexed', value: String(snapshot.paths.length), tone: '#2d62ff' },
      { label: 'dirty', value: String(gitInfo.dirty), tone: COLORS.yellow },
      { label: 'tabs', value: String(stateRef.current.openTabs.length), tone: COLORS.green },
      { label: 'agent', value: stateRef.current.activeAgentId ? 'live' : stateRef.current.agentStatusText, tone: COLORS.purple },
    ]);
    buildLandingProjects(snapshot.paths, gitInfo, nextWorkspaceName);
    buildLandingRecentFiles(snapshot.paths, gitInfo);

    setOpenTabs((prev) => prev.map((tab) => ({ ...tab, git: tab.path !== '__landing__' ? (gitStatusByPathRef.current[tab.path] || '') : '' })));

    if (!workspaceBootstrappedRef.current || stateRef.current.chatMessages.length === 0) {
      setChatMessages(buildSeedMessages(gitInfo.branch, gitInfo.dirty, pwd, stateRef.current.modelDisplayName || 'Opus 4'));
    }

    if (stateRef.current.activeView === 'landing' || stateRef.current.currentFilePath === '__landing__' || !stateRef.current.currentFilePath) {
      buildBreadcrumbs('__landing__', nextWorkspaceName, gitInfo.branch);
      markSelectedPath('__landing__');
    } else if (stateRef.current.activeView === 'settings' || stateRef.current.currentFilePath === '__settings__') {
      buildBreadcrumbs('__settings__', nextWorkspaceName, gitInfo.branch);
      markSelectedPath('__landing__');
    } else {
      buildBreadcrumbs(stateRef.current.currentFilePath, nextWorkspaceName, gitInfo.branch);
      markSelectedPath(stateRef.current.currentFilePath);
    }
    workspaceBootstrappedRef.current = true;
  }

  function rebuildPlainEditorPresentation(content: string, path: string) {
    const lines = content.length > 0 ? content.split('\n') : [''];
    const rows = new Array(lines.length);
    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const display = line.indexOf('\t') >= 0 ? line.replace(/\t/g, '  ') : line;
      rows[idx] = {
        line: idx + 1,
        charCount: display.length,
        marker: lineMarker(line),
        previewWidth: 20 + ((line.length * 3) % 80),
      };
    }
    setTotalLines(lines.length);
    setEditorRows(rows);
    setEditorColorRows(null);
    setEditorLargeFileMode(1);
    setLanguageMode(languageForType(inferFileType(path)));
  }

  function rebuildEditorPresentation(content: string, path: string) {
    try {
      const lines = content.length > 0 ? content.split('\n') : [''];
      const largeFileMode = lines.length > 1800 || content.length > 90000;
      let inImportSpecifiers = false;
      const rows = new Array(lines.length);
      const colorRows = new Array(lines.length);

      for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        const trimmed = line.trim();
        const display = line.indexOf('\t') >= 0 ? line.replace(/\t/g, '  ') : line;
        const tokens = tokenizeLine(line, { inImportSpecifiers });

        rows[idx] = {
          line: idx + 1,
          charCount: display.length,
          marker: lineMarker(line),
          previewWidth: 20 + ((line.length * 3) % 80),
        };
        colorRows[idx] = tokens.map((token: any) => ({
          text: token.text,
          color: editorTokenTone(token.kind),
        }));

        if (!inImportSpecifiers && /^import\s*\{/.test(trimmed) && !trimmed.includes('}')) {
          inImportSpecifiers = true;
        } else if (inImportSpecifiers && trimmed.includes('}')) {
          inImportSpecifiers = false;
        }
      }

      setTotalLines(lines.length);
      setEditorRows(rows);
      setEditorColorRows(colorRows);
      setEditorLargeFileMode(largeFileMode ? 1 : 0);
      setLanguageMode(languageForType(inferFileType(path)));
    } catch (error) {
      console.error('[cursor-ide] rebuildEditorPresentation failed', path, content.length, error);
      rebuildPlainEditorPresentation(content, path);
    }
  }

  function ensureHomeTab(list: Tab[]): Tab[] {
    if (list.some((tab) => tab.path === '__landing__')) return list;
    return [{ id: 'home', name: 'Projects', path: '__landing__', type: 'home', modified: 0, pinned: 1, git: '' }, ...list];
  }

  function ensureTabForPath(path: string) {
    let nextTabs = ensureHomeTab([...stateRef.current.openTabs]);
    let tabId = '';
    nextTabs = nextTabs.map((tab) => {
      if (tab.path === path) {
        tabId = tab.id;
        return { ...tab, git: gitStatusByPathRef.current[path] || '' };
      }
      return tab;
    });
    if (!tabId) {
      tabId = 't' + String(nextTabs.length + 1);
      nextTabs.push({
        id: tabId,
        name: baseName(path),
        path,
        type: inferFileType(path),
        modified: 0,
        pinned: 0,
        git: gitStatusByPathRef.current[path] || '',
      });
    }
    setOpenTabs(nextTabs);
    setActiveTabId(tabId);
  }

  function openLandingPage() {
    setOpenTabs((prev) => ensureHomeTab([...prev]));
    setActiveView('landing');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('landing');
    setCurrentFilePath('__landing__');
    editorContentRef.current = '';
    setEditorContent('');
    setEditorRows([]);
    setEditorColorRows(null);
    setEditorLargeFileMode(0);
    setEditorModified(0);
    setTotalLines(0);
    setLanguageMode('Workspace');
    setActiveTabId('home');
    buildBreadcrumbs('__landing__');
    markSelectedPath('__landing__');
  }

  function openSettingsSurface() {
    let nextTabs = ensureHomeTab([...stateRef.current.openTabs]);
    let tabId = 'settings';
    if (!nextTabs.some((tab) => tab.path === '__settings__')) {
      nextTabs.push({ id: 'settings', name: 'Settings', path: '__settings__', type: 'settings', modified: 0, pinned: 1, git: '' });
    } else {
      const settingsTab = nextTabs.find((tab) => tab.path === '__settings__');
      if (settingsTab) tabId = settingsTab.id;
    }
    setOpenTabs(nextTabs);
    setActiveView('settings');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('settings');
    setCurrentFilePath('__settings__');
    editorContentRef.current = '';
    setEditorContent('');
    setEditorRows([]);
    setEditorColorRows(null);
    setEditorLargeFileMode(0);
    setEditorModified(0);
    setTotalLines(0);
    setLanguageMode('Settings');
    setActiveTabId(tabId);
    buildBreadcrumbs('__settings__');
    markSelectedPath('__landing__');
  }

  function loadFileByPath(path: string) {
    if (path === '__settings__') {
      openSettingsSurface();
      return;
    }
    if (path === '__landing__' || path === '.' || inferFileType(path) === 'workspace') {
      openLandingPage();
      return;
    }

    let content = fileContentsRef.current[path];
    if (!content) {
      const diskContent = readFile(path);
      if (diskContent) {
        content = diskContent;
        fileContentsRef.current[path] = diskContent;
      } else {
        content = '// ' + path + '\n';
      }
    }

    setActiveView('editor');
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('editor');
    editorContentRef.current = content;
    setEditorContent(content);
    setCurrentFilePath(path);
    setEditorModified(0);
    rebuildEditorPresentation(content, path);
    buildBreadcrumbs(path);
    ensureTabForPath(path);
    markSelectedPath(path);
  }

  function activateTab(id: string) {
    if (id === 'home') {
      openLandingPage();
      return;
    }
    if (id === 'settings') {
      openSettingsSurface();
      return;
    }
    const tab = stateRef.current.openTabs.find((item: Tab) => item.id === id);
    if (tab) loadFileByPath(tab.path);
  }

  function closeTab(id: string) {
    if (id === 'home') return;
    const tabs = stateRef.current.openTabs.filter((tab: Tab) => tab.id !== id);
    setOpenTabs(tabs);
    if (tabs.length === 0 || stateRef.current.activeTabId === id) {
      openLandingPage();
    } else {
      activateTab(tabs[tabs.length - 1].id);
    }
  }

  function toggleDir(path: string) {
    setFiles((prev) => {
      const next = prev.map((item) => samePath(item.path, path) ? { ...item, expanded: item.expanded ? 0 : 1 } : { ...item });
      return applyTreeVisibility(next);
    });
  }

  function openFileByPath(path: string) {
    const item = stateRef.current.files?.find((entry: FileItem) => samePath(entry.path, path));
    if (item && item.type === 'dir') {
      toggleDir(path);
      return;
    }
    loadFileByPath(path);
  }

  function openSearchResult(path: string, line: number) {
    if (path === '(no results)') return;
    loadFileByPath(path);
    setShowSearch(0);
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('editor');
  }

  function updateEditorContent(text: string) {
    const path = stateRef.current.currentFilePath;
    if (path === '__landing__' || path === '__settings__') return;
    // Hot path (every keystroke): mirror the text to a ref — NO setState.
    // Keeping editorContent state stable across typing is what stops React
    // from emitting a 1.6 MB UPDATE-value-prop op per character.
    editorContentRef.current = text;
    fileContentsRef.current[path] = text;
    // Flip the dirty indicators only on the first keystroke after clean.
    // Subsequent keystrokes skip setState so we don't re-render for nothing.
    const curTab = stateRef.current.openTabs.find((t: Tab) => t.path === path);
    if (!curTab || curTab.modified !== 1) {
      setEditorModified(1);
      setGitStatus('*' + (stateRef.current.changedCount > 0 ? stateRef.current.changedCount : 1));
      setOpenTabs((prev) => prev.map((tab) => tab.path === path ? { ...tab, modified: 1 } : tab));
    }
    // Blow away stale syntax-highlight rows so the engine falls through to
    // painting the live buffer text (paintText={true}) while we're typing.
    // Without this, the engine would keep painting pre-keystroke tokenized
    // rows and the new characters would be invisible until the debounce fires.
    // React bails on setState-with-same-value, so after the first keystroke
    // this is a no-op until the rebuild below sets rows back.
    setEditorColorRows(null);
    // Syntax highlighting: debounced so we don't re-regex 143 KB per keystroke.
    if (rebuildTimerRef.current) clearTimeout(rebuildTimerRef.current);
    rebuildTimerRef.current = setTimeout(() => {
      rebuildTimerRef.current = null;
      rebuildEditorPresentation(editorContentRef.current, stateRef.current.currentFilePath);
    }, 300);
  }


  function saveCurrentFile() {
    const path = stateRef.current.currentFilePath;
    if (path === '__landing__' || path === '__settings__') return;
    const execId = 'write_' + Date.now();
    addToolExecution(execId, 'writeFile', path);
    const text = editorContentRef.current;
    const wrote = writeFile(path, text);
    fileContentsRef.current[path] = text;
    // Deliberately do NOT call setEditorContent(text) here. React's `value`
    // prop stays pinned at whatever was last passed on mount/file-load, so
    // reconciler prop-diffs during subsequent re-renders produce no UPDATE
    // op. The framework buffer already holds `text` (user typed it in), and
    // the next file-switch will set React state from fileContentsRef anyway.
    setOpenTabs((prev) => prev.map((tab) => tab.path === path ? { ...tab, modified: 0 } : tab));
    setEditorModified(0);
    if (wrote) completeToolExecution(execId, 'saved ' + path);
    else failToolExecution(execId, 'write failed');
    refreshWorkspace();
  }

  function createNewFile() {
    const path = 'cart/cursor-ide/scratch.tsx';
    if (!fileContentsRef.current[path]) {
      fileContentsRef.current[path] = '// scratch.tsx\n';
      writeFile(path, fileContentsRef.current[path]);
    }
    clearExecCache(); // tree changed — drop cached find/git output
    refreshWorkspace();
    loadFileByPath(path);
  }

  function recentSearchFallback(): SearchResult[] {
    return cachedTreePathsRef.current.slice(0, 8).map((path) => ({ file: path, line: 1, text: 'Recent workspace path', matches: 1 }));
  }

  function searchProject(query: string) {
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('search');
    setSearchQuery(query);
    if (!query) {
      setSearchResults(recentSearchFallback());
      return;
    }
    const execId = 'grep_' + Date.now();
    addToolExecution(execId, 'grep', query);
    const raw = exec('rg -n --no-heading ' + JSON.stringify(query) + ' . 2>/dev/null | head -60');
    const results: SearchResult[] = [];
    if (raw) {
      for (const line of raw.split('\n')) {
        const clean = stripDotSlash(line);
        if (!clean) continue;
        const c1 = clean.indexOf(':');
        if (c1 < 0) continue;
        const file = clean.slice(0, c1);
        const rest = clean.slice(c1 + 1);
        const c2 = rest.indexOf(':');
        if (c2 < 0) continue;
        results.push({ file, line: parseInt(rest.slice(0, c2), 10) || 1, text: rest.slice(c2 + 1), matches: 1 });
      }
    }
    if (results.length === 0) results.push({ file: '(no results)', line: 0, text: 'No matches for: ' + query, matches: 0 });
    setSearchResults(results);
    completeToolExecution(execId, results.length + ' result(s)');
  }

  function indexProject() {
    const execId = 'index_' + Date.now();
    addToolExecution(execId, 'index', '.');
    clearExecCache(); // user asked for a fresh scan — bypass the memo
    refreshWorkspace();
    completeToolExecution(execId, cachedTreePathsRef.current.length + ' paths indexed');
  }

  function setAgentMode(mode: string) {
    setAgentModeState(mode);
  }

  function addAttachment(type: string, name: string, path: string) {
    const id = 'a' + String(Date.now()) + '_' + String(Math.floor(Math.random() * 1000));
    replaceAttachments([...stateRef.current.attachments, { id, type, name, path }]);
  }

  function removeAttachment(id: string) {
    replaceAttachments(stateRef.current.attachments.filter((attachment: any) => attachment.id !== id));
  }

  function clearAttachments() {
    replaceAttachments([]);
  }

  function attachCurrentFile() {
    if (stateRef.current.currentFilePath === '__landing__') {
      addAttachment('workspace', stateRef.current.workspaceName, stateRef.current.workDir || '.');
      return;
    }
    if (stateRef.current.currentFilePath === '__settings__') {
      addAttachment('surface', 'Settings', '__settings__');
      return;
    }
    addAttachment('file', baseName(stateRef.current.currentFilePath), stateRef.current.currentFilePath);
  }

  function attachGitContext() {
    addAttachment('git', stateRef.current.gitBranch + ' diff', 'git-status');
  }

  function triggerSymbolMention() {
    if (stateRef.current.currentFilePath !== '__landing__' && stateRef.current.currentFilePath !== '__settings__') {
      addAttachment('symbol', baseName(stateRef.current.currentFilePath) + ':focus', stateRef.current.currentFilePath);
    }
  }

  function toggleWebSearch() {
    setWebSearchState((prev) => prev ? 0 : 1);
  }

  function toggleTermAccess() {
    setTermAccessState((prev) => prev ? 0 : 1);
  }

  function toggleAutoApply() {
    setAutoApplyState((prev) => prev ? 0 : 1);
  }

  function cycleModel() {
    const models = [
      { id: 'claude-opus-4', name: 'Opus 4' },
      { id: 'claude-sonnet-4', name: 'Sonnet 4' },
      { id: 'gpt-5.4', name: 'GPT-5.4' },
      { id: 'o1-preview', name: 'o1' },
    ];
    let idx = models.findIndex((model) => model.id === stateRef.current.selectedModel);
    if (idx < 0) idx = 0;
    const next = models[(idx + 1) % models.length];
    setSelectedModel(next.id);
    setModelDisplayName(next.name);
  }

  function startNewConversation() {
    setChatMessages(buildSeedMessages(stateRef.current.gitBranch, stateRef.current.changedCount, stateRef.current.workDir || '.', stateRef.current.modelDisplayName || 'Opus 4'));
    replaceAttachments([]);
    replaceComposer('');
    setIsGenerating(0);
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('agent');
  }

  function buildAgentPayload(text: string) {
    let model = 'claude-opus-4-1';
    if (stateRef.current.selectedModel === 'claude-sonnet-4') model = 'claude-sonnet-4-20250514';
    const attachmentSummary = stateRef.current.attachments.map((attachment: any) => attachment.type + ':' + attachment.name).join(' ');
    let systemPrompt = 'You are an expert coding assistant inside Cursor IDE. Workspace: ' +
      stateRef.current.workspaceName + '. Root: ' + stateRef.current.workDir + '. Branch: ' + stateRef.current.gitBranch + '. ' +
      stateRef.current.changedCount + ' dirty paths, ' + stateRef.current.stagedCount + ' staged. Current file: ' + stateRef.current.currentFilePath + '. Attachments: ' + attachmentSummary + '.';
    if (stateRef.current.agentMode === 'plan') systemPrompt += ' Show a step-by-step plan before editing.';
    if (stateRef.current.agentMode === 'task') systemPrompt += ' Execute the task autonomously and explain the file changes.';
    if (stateRef.current.agentMode === 'agent') systemPrompt += ' This launches a background agent session.';
    return { model, max_tokens: 1200, system: systemPrompt, messages: [{ role: 'user', content: text }] };
  }

  function callClaudeAPI(text: string): string {
    if (!stateRef.current.selectedModel.startsWith('claude-')) return '';
    const apiKey = exec('printf %s "$ANTHROPIC_API_KEY"').trim();
    if (apiKey.length < 20) return '';
    const payload = buildAgentPayload(text);
    const escaped = JSON.stringify(payload).replace(/'/g, "'\\''");
    const raw = exec(
      'curl -s --max-time 30 -X POST https://api.anthropic.com/v1/messages ' +
      '-H "x-api-key: ' + apiKey + '" ' +
      '-H "anthropic-version: 2023-06-01" ' +
      '-H "content-type: application/json" ' +
      '-d \'' + escaped + '\''
    );
    if (!raw) return '';
    try {
      const resp = JSON.parse(raw);
      if (resp.content && resp.content[0] && resp.content[0].text) return resp.content[0].text;
      if (resp.error && resp.error.message) return 'API error: ' + resp.error.message;
    } catch {}
    return '';
  }

  function generateFallbackResponse(text: string): string {
    if (stateRef.current.agentMode === 'plan') {
      return 'Plan for "' + text.slice(0, 60) + '"\n\n' +
        '1. Traverse the explorer and inspect the changed files.\n' +
        '2. Read ' + stateRef.current.currentFilePath + ' with branch context from ' + stateRef.current.gitBranch + '.\n' +
        '3. Stage a targeted edit and compare against the current dirty set.\n' +
        '4. Summarize the diff before applying.';
    }
    if (stateRef.current.agentMode === 'task') {
      return 'Task mode is live. I used the workspace explorer, git context, and terminal access to reason about the repo before touching ' + stateRef.current.currentFilePath + '.';
    }
    if (text.toLowerCase().includes('git')) {
      return 'Git is connected to ' + stateRef.current.gitRemote + ' on ' + stateRef.current.gitBranch + '. There are ' + stateRef.current.changedCount + ' dirty paths and ' + stateRef.current.stagedCount + ' staged paths in the current workspace.';
    }
    return 'Workspace summary: ' + stateRef.current.workspaceName + ' on ' + stateRef.current.gitBranch + ', ' + stateRef.current.changedCount + ' dirty paths, current focus ' + stateRef.current.currentFilePath + '.';
  }

  function sendMessage() {
    if (stateRef.current.currentInput.length === 0 && stateRef.current.attachments.length === 0) return;
    const text = stateRef.current.currentInput.length > 0 ? stateRef.current.currentInput : '[attached ' + stateRef.current.attachments.length + ' context item(s)]';
    const nextMessages: Message[] = [
      ...stateRef.current.chatMessages,
      {
        role: 'user',
        time: 'now',
        text,
        mode: stateRef.current.agentMode,
        model: stateRef.current.selectedModel,
        attachments: stateRef.current.attachments,
      },
    ];
    setChatMessages(nextMessages);
    setCurrentInputState('');
    setAttachmentsState([]);
    setInputTokenEstimateState(0);
    setIsGenerating(1);
    setAgentStatusText('streaming');
    setToolExecutions([]);

    if (stateRef.current.agentMode === 'agent') {
      const agentId = 'agent_' + Date.now();
      setActiveAgentId(agentId);
      setAgentStatusText('executing');
      const runner = exec('command -v tsz-agent 2>/dev/null').trim();
      if (runner) {
        exec('tsz-agent --fork ' + JSON.stringify(text) + ' --id ' + agentId + ' >/dev/null 2>&1 &');
      }
      setChatMessages([
        ...nextMessages,
        {
          role: 'assistant',
          time: 'now',
          model: stateRef.current.selectedModel,
          text: runner
            ? 'Background agent launched as ' + agentId + '. It is reading the same workspace, git branch, and landing metadata you see in the shell.'
            : 'Background agent mode is simulated in this port. The shell still tracks an active agent session and shared context, but no external worker binary is wired here yet.',
        },
      ]);
      setIsGenerating(0);
      return;
    }

    const toolSnapshot: ToolExecution[] = [];
    if (stateRef.current.termAccess) {
      toolSnapshot.push({ id: 'glob_' + Date.now(), name: 'glob', input: 'workspace scan', status: 'completed', percent: 100, result: cachedTreePathsRef.current.length + ' indexed paths' });
      toolSnapshot.push({ id: 'git_' + (Date.now() + 1), name: 'git', input: 'status --short', status: 'completed', percent: 100, result: stateRef.current.changedCount + ' dirty / ' + stateRef.current.stagedCount + ' staged' });
    }
    const llmId = 'llm_' + Date.now();
    setToolExecutions([...toolSnapshot, { id: llmId, name: 'LLM', input: stateRef.current.selectedModel + ': ' + text.slice(0, 48), status: 'running', percent: 20, result: '' }]);
    let responseText = callClaudeAPI(text);
    if (!responseText) responseText = generateFallbackResponse(text);
    const llmDone = { id: llmId, name: 'LLM', input: stateRef.current.selectedModel + ': ' + text.slice(0, 48), status: 'completed', percent: 100, result: responseText.length > 80 ? responseText.slice(0, 80) + '...' : responseText };
    const finalSnapshot = [...toolSnapshot, llmDone];
    setToolExecutions(finalSnapshot);
    setChatMessages([
      ...nextMessages,
      {
        role: 'assistant',
        time: 'now',
        text: responseText,
        model: stateRef.current.selectedModel,
        toolSnapshot: finalSnapshot,
      },
    ]);
    setStreamingText(responseText);
    setIsGenerating(0);
    setAgentStatusText('idle');
  }

  function stopBackgroundAgent() {
    setActiveAgentId('');
    setAgentStatusText('idle');
    setIsGenerating(0);
  }

  function openTerminal() {
    if (!ptyStartedRef.current) {
      ptyOpen(110, 28);
      ptyStartedRef.current = true;
    }
    if (stateRef.current.widthBand === 'narrow' || stateRef.current.widthBand === 'widget' || stateRef.current.widthBand === 'minimum') setCompactSurface('terminal');
  }

  function selectSlashCommand(cmd: string) {
    replaceComposer(cmd + ' ');
  }

  useEffect(() => {
    syncWindowMetrics();
    refreshWorkspace();
    setSearchResults(recentSearchFallback());
    const timer = setInterval(syncWindowMetrics, 120);
    return () => clearInterval(timer);
  }, []);

  const mainSurface = primaryMainView(activeView, currentFilePath);
  const compactMode = widthBand === 'narrow' || widthBand === 'widget' || widthBand === 'minimum';
  const widgetMode = widthBand === 'widget';
  const minimumMode = widthBand === 'minimum';
  const mediumMode = widthBand === 'medium';
  const rightRail = showSearch ? 'search' : showChat ? 'agent' : '';
  let tabsForBar = openTabs;
  let landingStats = workspaceStats;
  let landingRecent = landingRecentFiles;
  let landingConnections = gitConnections;
  if (compactMode) {
    tabsForBar = minimumMode ? visibleTabs(openTabs, activeTabId, 2) : widgetMode ? visibleTabs(openTabs, activeTabId, 3) : visibleTabs(openTabs, activeTabId, 4);
  } else if (mediumMode) {
    tabsForBar = visibleTabs(openTabs, activeTabId, 6);
  }
  if (minimumMode) landingStats = takeList(workspaceStats, 2);
  else if (widgetMode) landingStats = takeList(workspaceStats, 3);
  if (minimumMode) landingRecent = takeList(landingRecentFiles, 3);
  else if (widgetMode) landingRecent = takeList(landingRecentFiles, 4);
  else if (compactMode) landingRecent = takeList(landingRecentFiles, 5);
  if (compactMode) landingConnections = widgetMode ? takeList(gitConnections, 3) : takeList(gitConnections, 4);
  const showStatusBar = !minimumMode && windowHeight >= 300;
  const showDockedSearch = !compactMode && rightRail === 'search';
  const showDockedChat = !compactMode && rightRail === 'agent';
  const showDockedTerminal = showTerminal === 1 && !compactMode;
  const compactMainView = compactSurface === 'landing' ? 'landing' : compactSurface === 'settings' ? 'settings' : 'editor';

  return (
    <Box style={{ width: '100%', height: '100%', backgroundColor: COLORS.appBg }}>
      <Col style={{ width: '100%', height: '100%' }}>
        <TopBar
          displayTitle={currentFilePath === '__landing__' ? 'Project landing' : currentFilePath === '__settings__' ? 'Settings' : minimumMode ? baseName(currentFilePath) : currentFilePath}
          workspaceName={workspaceName}
          gitBranch={gitBranch}
          changedCount={changedCount}
          stagedCount={stagedCount}
          widthBand={widthBand}
          settingsActive={compactMode ? compactSurface === 'settings' : activeView === 'settings'}
          searchActive={compactMode ? compactSurface === 'search' : showDockedSearch}
          chatActive={compactMode ? compactSurface === 'agent' : showDockedChat}
          terminalActive={compactMode ? compactSurface === 'terminal' : showTerminal}
          onOpenHome={openLandingPage}
          onOpenSettings={openSettingsSurface}
          onRefreshWorkspace={refreshWorkspace}
          onToggleChat={() => {
            if (compactMode) {
              if (compactSurface === 'agent') {
                setShowChat(0);
                setCompactSurface(mainSurface);
              } else {
                setShowChat(1);
                setCompactSurface('agent');
              }
            } else {
              setShowChat(showChat ? 0 : 1);
            }
          }}
          onToggleTerminal={() => {
            openTerminal();
            if (compactMode) {
              if (compactSurface === 'terminal') {
                setShowTerminal(0);
                setCompactSurface(mainSurface);
              } else {
                setShowTerminal(1);
                setCompactSurface('terminal');
              }
            } else {
              setShowTerminal(showTerminal ? 0 : 1);
            }
          }}
          onToggleSearch={() => {
            if (compactMode) {
              if (compactSurface === 'search') {
                setShowSearch(0);
                setCompactSurface(mainSurface);
              } else {
                setShowSearch(1);
                searchProject(searchQuery);
                setCompactSurface('search');
              }
            } else {
              const next = showSearch ? 0 : 1;
              setShowSearch(next);
              if (next) searchProject(searchQuery);
            }
          }}
        />

        {compactMode ? (
          <Col style={{ flexGrow: 1, flexBasis: 0 }}>
            <Row style={{ gap: 8, padding: 10, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.panelBg }}>
              <CompactSurfaceButton label="Files" showLabel={!minimumMode} active={compactSurface === 'explorer'} onPress={() => setCompactSurface('explorer')} icon="folder" />
              {mainSurface === 'landing' ? <CompactSurfaceButton label="Projects" showLabel={!minimumMode} active={compactSurface === 'landing'} onPress={openLandingPage} icon="house" /> : null}
              {mainSurface === 'editor' ? <CompactSurfaceButton label="Editor" showLabel={!minimumMode} active={compactSurface === 'editor'} onPress={() => setCompactSurface('editor')} icon="panel-left" /> : null}
              <CompactSurfaceButton label="Settings" showLabel={!minimumMode} active={compactSurface === 'settings'} onPress={openSettingsSurface} icon="palette" />
              <CompactSurfaceButton label="Search" showLabel={!minimumMode} active={compactSurface === 'search'} onPress={() => { setShowSearch(1); searchProject(searchQuery); setCompactSurface('search'); }} icon="search" />
              <CompactSurfaceButton label="Term" showLabel={!minimumMode} active={compactSurface === 'terminal'} onPress={() => { openTerminal(); setShowTerminal(1); setCompactSurface('terminal'); }} icon="terminal" />
              <CompactSurfaceButton label="Agent" showLabel={!minimumMode} active={compactSurface === 'agent'} onPress={() => { setShowChat(1); setCompactSurface('agent'); }} icon="message" />
            </Row>

            {compactSurface === 'explorer' ? (
              <Sidebar
                files={files}
                tabs={openTabs}
                gitChanges={gitChanges}
                workspaceName={workspaceName}
                workDir={workDir}
                gitBranch={gitBranch}
                changedCount={changedCount}
                stagedCount={stagedCount}
                currentFilePath={currentFilePath}
                widthBand={widthBand}
                style={{ width: '100%', borderRightWidth: 0 }}
                onOpenHome={openLandingPage}
                onRefreshWorkspace={refreshWorkspace}
                onSelectPath={openFileByPath}
                onCreateFile={createNewFile}
              />
            ) : null}

            {compactSurface === 'landing' || compactSurface === 'editor' || compactSurface === 'settings' ? (
              <Col style={{ flexGrow: 1, flexBasis: 0 }}>
                <TabBar tabs={tabsForBar} activeId={activeTabId} compact={true} onActivate={activateTab} onClose={closeTab} />
                <BreadcrumbBar items={visibleBreadcrumbs(breadcrumbs, widthBand)} compact={true} onOpenHome={openLandingPage} />
                {compactMainView === 'landing' ? (
                  <LandingSurface
                    workspaceName={workspaceName}
                    workspaceTagline={workspaceTagline}
                    workDir={workDir}
                    gitBranch={gitBranch}
                    gitRemote={gitRemote}
                    branchAhead={branchAhead}
                    branchBehind={branchBehind}
                    changedCount={changedCount}
                    stagedCount={stagedCount}
                    widthBand={widthBand}
                    stats={landingStats}
                    projects={landingProjects}
                    recentFiles={landingRecent}
                    connections={landingConnections}
                    onOpenPath={openFileByPath}
                    onIndexWorkspace={indexProject}
                    onOpenSettings={openSettingsSurface}
                  />
                ) : null}
                {compactMainView === 'settings' ? (
                  <SettingsSurface
                    activeSection={settingsSection}
                    selectedProviderId={selectedProviderId}
                    selectedModelName={modelDisplayName}
                    workspaceName={workspaceName}
                    gitBranch={gitBranch}
                    agentStatusText={agentStatusText}
                    workDir={workDir}
                    widthBand={widthBand}
                    sections={[
                      { id: 'providers', label: 'Providers', meta: 'model routing + auth + components', tone: '#79c0ff', icon: 'globe', count: String(SETTINGS_PROVIDERS.length) },
                      { id: 'context', label: 'Context', meta: 'workspace + git + external sources', tone: '#7ee787', icon: 'folder', count: String(SETTINGS_CONTEXT_ROWS.length) },
                      { id: 'memory', label: 'Memory', meta: 'session + sqlite + transcript stores', tone: '#d2a8ff', icon: 'bot', count: String(SETTINGS_MEMORY_ROWS.length) },
                      { id: 'plugins', label: 'Plugins', meta: 'lua + qjs + marketplace parity', tone: '#ffa657', icon: 'palette', count: String(SETTINGS_PLUGIN_ROWS.length) },
                      { id: 'automations', label: 'Automations', meta: 'ifttt rules + build hooks', tone: '#ff7b72', icon: 'sparkles', count: String(SETTINGS_AUTOMATION_ROWS.length) },
                      { id: 'capabilities', label: 'Capabilities', meta: 'existing runtime references to bake in', tone: '#ffb86b', icon: 'braces', count: String(SETTINGS_CAPABILITY_ROWS.length) },
                    ]}
                    providers={SETTINGS_PROVIDERS}
                    contextRows={SETTINGS_CONTEXT_ROWS}
                    memoryRows={SETTINGS_MEMORY_ROWS}
                    pluginRows={SETTINGS_PLUGIN_ROWS}
                    automationRows={SETTINGS_AUTOMATION_ROWS}
                    capabilityRows={SETTINGS_CAPABILITY_ROWS}
                    onSelectSection={setSettingsSection}
                    onSelectProvider={setSelectedProviderId}
                  />
                ) : null}
                {compactMainView === 'editor' ? (
                  <EditorSurface
                    content={editorContent}
                    editorRows={editorRows}
                    editorColorRows={editorColorRows}
                    largeFileMode={editorLargeFileMode}
                    totalLines={totalLines}
                    cursorLine={cursorPosition.line}
                    cursorColumn={cursorPosition.column}
                    modified={editorModified}
                    currentFilePath={currentFilePath}
                    widthBand={widthBand}
                    windowHeight={windowHeight}
                    onChange={updateEditorContent}
                    onSave={saveCurrentFile}
                  />
                ) : null}
              </Col>
            ) : null}

            {compactSurface === 'search' ? (
              <SearchSurface
                query={searchQuery}
                results={searchResults}
                workspaceName={workspaceName}
                gitBranch={gitBranch}
                widthBand={widthBand}
                style={{ width: '100%' }}
                onClose={() => { setShowSearch(0); setCompactSurface(mainSurface); }}
                onQuery={searchProject}
                onOpenResult={openSearchResult}
              />
            ) : null}

            {compactSurface === 'agent' ? (
              <ChatSurface
                messages={chatMessages}
                isGenerating={!!isGenerating}
                currentFilePath={currentFilePath}
                gitBranch={gitBranch}
                gitRemote={gitRemote}
                changedCount={changedCount}
                workspaceName={workspaceName}
                activeView={activeView}
                widthBand={widthBand}
                style={{ width: '100%' }}
                selectedModel={selectedModel}
                currentInput={currentInput}
                agentMode={agentMode}
                attachments={attachments}
                webSearch={!!webSearch}
                termAccess={!!termAccess}
                autoApply={!!autoApply}
                inputTokenEstimate={inputTokenEstimate}
                modelDisplayName={modelDisplayName}
                toolExecutions={toolExecutions}
                activeAgentId={activeAgentId}
                agentStatusText={agentStatusText}
                onNewConversation={startNewConversation}
                onIndex={indexProject}
                onSetMode={setAgentMode}
                onInputChange={(value: string) => replaceComposer(value)}
                onAttachCurrentFile={attachCurrentFile}
                onAttachSymbol={triggerSymbolMention}
                onAttachGit={attachGitContext}
                onToggleWebSearch={toggleWebSearch}
                onToggleTermAccess={toggleTermAccess}
                onToggleAutoApply={toggleAutoApply}
                onCycleModel={cycleModel}
                onSend={sendMessage}
                onRemoveAttachment={removeAttachment}
                onClearAttachments={clearAttachments}
                onSelectSlash={selectSlashCommand}
                onStopAgent={stopBackgroundAgent}
              />
            ) : null}

            {compactSurface === 'terminal' ? (
              <TerminalPanel
                workDir={workDir}
                gitBranch={gitBranch}
                widthBand={widthBand}
                onClose={() => { setShowTerminal(0); setCompactSurface(mainSurface); }}
              />
            ) : null}
          </Col>
        ) : (
          <Row style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
            <Sidebar
              files={files}
              tabs={openTabs}
              gitChanges={gitChanges}
              workspaceName={workspaceName}
              workDir={workDir}
              gitBranch={gitBranch}
              changedCount={changedCount}
              stagedCount={stagedCount}
              currentFilePath={currentFilePath}
              widthBand={widthBand}
              style={mediumMode ? { width: 248 } : undefined}
              onOpenHome={openLandingPage}
              onRefreshWorkspace={refreshWorkspace}
              onSelectPath={openFileByPath}
              onCreateFile={createNewFile}
            />

            <Col style={{ flexGrow: 1, flexBasis: 0, minHeight: 0 }}>
              <TabBar tabs={tabsForBar} activeId={activeTabId} compact={false} onActivate={activateTab} onClose={closeTab} />
              <BreadcrumbBar items={visibleBreadcrumbs(breadcrumbs, widthBand)} compact={false} onOpenHome={openLandingPage} />
              {activeView === 'landing' ? (
                <LandingSurface
                  workspaceName={workspaceName}
                  workspaceTagline={workspaceTagline}
                  workDir={workDir}
                  gitBranch={gitBranch}
                  gitRemote={gitRemote}
                  branchAhead={branchAhead}
                  branchBehind={branchBehind}
                  changedCount={changedCount}
                  stagedCount={stagedCount}
                  widthBand={widthBand}
                  stats={landingStats}
                  projects={landingProjects}
                  recentFiles={landingRecent}
                  connections={landingConnections}
                  onOpenPath={openFileByPath}
                  onIndexWorkspace={indexProject}
                  onOpenSettings={openSettingsSurface}
                />
              ) : null}
              {activeView === 'settings' ? (
                <SettingsSurface
                  activeSection={settingsSection}
                  selectedProviderId={selectedProviderId}
                  selectedModelName={modelDisplayName}
                  workspaceName={workspaceName}
                  gitBranch={gitBranch}
                  agentStatusText={agentStatusText}
                  workDir={workDir}
                  widthBand={widthBand}
                  sections={[
                    { id: 'providers', label: 'Providers', meta: 'model routing + auth + components', tone: '#79c0ff', icon: 'globe', count: String(SETTINGS_PROVIDERS.length) },
                    { id: 'context', label: 'Context', meta: 'workspace + git + external sources', tone: '#7ee787', icon: 'folder', count: String(SETTINGS_CONTEXT_ROWS.length) },
                    { id: 'memory', label: 'Memory', meta: 'session + sqlite + transcript stores', tone: '#d2a8ff', icon: 'bot', count: String(SETTINGS_MEMORY_ROWS.length) },
                    { id: 'plugins', label: 'Plugins', meta: 'lua + qjs + marketplace parity', tone: '#ffa657', icon: 'palette', count: String(SETTINGS_PLUGIN_ROWS.length) },
                    { id: 'automations', label: 'Automations', meta: 'ifttt rules + build hooks', tone: '#ff7b72', icon: 'sparkles', count: String(SETTINGS_AUTOMATION_ROWS.length) },
                    { id: 'capabilities', label: 'Capabilities', meta: 'existing runtime references to bake in', tone: '#ffb86b', icon: 'braces', count: String(SETTINGS_CAPABILITY_ROWS.length) },
                  ]}
                  providers={SETTINGS_PROVIDERS}
                  contextRows={SETTINGS_CONTEXT_ROWS}
                  memoryRows={SETTINGS_MEMORY_ROWS}
                  pluginRows={SETTINGS_PLUGIN_ROWS}
                  automationRows={SETTINGS_AUTOMATION_ROWS}
                  capabilityRows={SETTINGS_CAPABILITY_ROWS}
                  onSelectSection={setSettingsSection}
                  onSelectProvider={setSelectedProviderId}
                />
              ) : null}
              {activeView === 'editor' ? (
                <EditorSurface
                  content={editorContent}
                  editorRows={editorRows}
                  editorColorRows={editorColorRows}
                  largeFileMode={editorLargeFileMode}
                  totalLines={totalLines}
                  cursorLine={cursorPosition.line}
                  cursorColumn={cursorPosition.column}
                  modified={editorModified}
                  currentFilePath={currentFilePath}
                  widthBand={widthBand}
                  windowHeight={windowHeight}
                  onChange={updateEditorContent}
                  onSave={saveCurrentFile}
                />
              ) : null}
              {showDockedTerminal ? (
                <TerminalPanel
                  workDir={workDir}
                  gitBranch={gitBranch}
                  widthBand={widthBand}
                  height={mediumMode ? 210 : 250}
                  onClose={() => setShowTerminal(0)}
                />
              ) : null}
            </Col>

            {showDockedSearch ? (
              <SearchSurface
                query={searchQuery}
                results={searchResults}
                workspaceName={workspaceName}
                gitBranch={gitBranch}
                widthBand={widthBand}
                style={{ width: mediumMode ? 320 : 390 }}
                onClose={() => setShowSearch(0)}
                onQuery={searchProject}
                onOpenResult={openSearchResult}
              />
            ) : null}

            {showDockedChat ? (
              <ChatSurface
                messages={chatMessages}
                isGenerating={!!isGenerating}
                currentFilePath={currentFilePath}
                gitBranch={gitBranch}
                gitRemote={gitRemote}
                changedCount={changedCount}
                workspaceName={workspaceName}
                activeView={activeView}
                widthBand={widthBand}
                style={{ width: mediumMode ? 340 : 420 }}
                selectedModel={selectedModel}
                currentInput={currentInput}
                agentMode={agentMode}
                attachments={attachments}
                webSearch={!!webSearch}
                termAccess={!!termAccess}
                autoApply={!!autoApply}
                inputTokenEstimate={inputTokenEstimate}
                modelDisplayName={modelDisplayName}
                toolExecutions={toolExecutions}
                activeAgentId={activeAgentId}
                agentStatusText={agentStatusText}
                onNewConversation={startNewConversation}
                onIndex={indexProject}
                onSetMode={setAgentMode}
                onInputChange={(value: string) => replaceComposer(value)}
                onAttachCurrentFile={attachCurrentFile}
                onAttachSymbol={triggerSymbolMention}
                onAttachGit={attachGitContext}
                onToggleWebSearch={toggleWebSearch}
                onToggleTermAccess={toggleTermAccess}
                onToggleAutoApply={toggleAutoApply}
                onCycleModel={cycleModel}
                onSend={sendMessage}
                onRemoveAttachment={removeAttachment}
                onClearAttachments={clearAttachments}
                onSelectSlash={selectSlashCommand}
                onStopAgent={stopBackgroundAgent}
              />
            ) : null}
          </Row>
        )}

        {showStatusBar ? (
          <StatusBar
            gitBranch={gitBranch}
            gitStatus={gitStatus}
            gitRemote={gitRemote}
            branchAhead={branchAhead}
            branchBehind={branchBehind}
            changedCount={changedCount}
            stagedCount={stagedCount}
            cursorLine={cursorPosition.line}
            cursorColumn={cursorPosition.column}
            languageMode={languageMode}
            errors={errors}
            warnings={warnings}
            modified={editorModified}
            fileName={currentFilePath}
            workDir={workDir}
            selectedModel={modelDisplayName}
            agentStatusText={agentStatusText}
            widthBand={widthBand}
          />
        ) : null}
      </Col>
    </Box>
  );
}
