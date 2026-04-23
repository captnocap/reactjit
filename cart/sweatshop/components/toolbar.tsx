
import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { closeWindow, maximizeWindow, minimizeWindow } from '../host';
import { COLORS, TOKENS } from '../theme';
import { Glyph, HeaderButton, HoverPressable } from './shared';
import { MenuBar } from './menubar';
import { Tooltip } from './tooltip';

export function TopBar(props: any) {
  const compact = props.widthBand === 'narrow' || props.widthBand === 'widget' || props.widthBand === 'minimum';
  const minimum = props.widthBand === 'minimum';
  const chromeOnly = !!props.chromeOnly;
  return (
    <Col style={{ width: '100%', flexShrink: 0 }}>
      {!chromeOnly && props.menuSections ? <MenuBar sections={props.menuSections} /> : null}
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
            <Tooltip label="Close window" side="bottom"><HoverPressable onPress={closeWindow} style={{ padding: 2, borderRadius: 999, backgroundColor: 'transparent' }} hoverScale={1.12}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#ff5f57' }} /></HoverPressable></Tooltip>
            <Tooltip label="Minimize window" side="bottom"><HoverPressable onPress={minimizeWindow} style={{ padding: 2, borderRadius: 999, backgroundColor: 'transparent' }} hoverScale={1.12}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#febc2e' }} /></HoverPressable></Tooltip>
            <Tooltip label="Maximize window" side="bottom"><HoverPressable onPress={maximizeWindow} style={{ padding: 2, borderRadius: 999, backgroundColor: 'transparent' }} hoverScale={1.12}><Box style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#28c840' }} /></HoverPressable></Tooltip>
          </Row>

          {!chromeOnly ? (
          <Row style={{ alignItems: 'center', gap: 8 }}>
            <Tooltip label="Open workspace home" side="bottom" shortcut="Ctrl+P">
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
                borderRadius: TOKENS.radiusLg,
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
          </Tooltip>

          <Tooltip label="Go to landing view" side="bottom" shortcut="Ctrl+P">
            <Pressable
              onPress={props.onOpenHome}
              style={{
                flexDirection: 'column',
                gap: 1,
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: TOKENS.radiusLg,
                backgroundColor: COLORS.panelAlt,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              {!compact ? <Text fontSize={9} color={COLORS.blue}>Project landing</Text> : null}
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
                {props.displayTitle}
              </Text>
            </Pressable>
          </Tooltip>
          </Row>
          ) : null}
        </Row>

        {!chromeOnly ? (
        <Row style={{ alignItems: 'center', gap: 8, marginLeft: 10 }}>
          <Tooltip label="Open git panel" side="bottom">
            <Pressable
              onPress={props.onToggleGit}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 6,
                paddingBottom: 6,
                borderRadius: TOKENS.radiusLg,
                borderWidth: 1,
                borderColor: props.gitActive ? COLORS.blue : COLORS.border,
                backgroundColor: props.gitActive ? COLORS.blueDeep : COLORS.panelAlt,
              }}
            >
              <Glyph icon="git" tone={props.gitActive ? COLORS.blue : COLORS.green} backgroundColor="transparent" tiny={true} />
              <Text fontSize={10} color={COLORS.textBright}>{props.gitBranch}</Text>
              {!compact ? <Text fontSize={9} color={COLORS.textDim}>{props.changedCount + ' dirty / ' + props.stagedCount + ' staged'}</Text> : null}
            </Pressable>
          </Tooltip>
          <Tooltip label="Refresh workspace" side="bottom" shortcut="Ctrl+Shift+R"><HeaderButton label="Refresh" meta="R" icon="refresh" compact={compact} onPress={props.onRefreshWorkspace} /></Tooltip>
          <Tooltip label="Open settings" side="bottom" shortcut="Ctrl+,"><HeaderButton label="Settings" meta="S" icon="palette" compact={compact} active={props.settingsActive ? 1 : 0} onPress={props.onOpenSettings} /></Tooltip>
          <Tooltip label="Open search" side="bottom" shortcut="Ctrl+Shift+F"><HeaderButton label="Search" meta="F3" icon="search" compact={compact} active={props.searchActive ? 1 : 0} onPress={props.onToggleSearch} /></Tooltip>
          <Tooltip label="Toggle terminal" side="bottom" shortcut="Ctrl+`"><HeaderButton label="Terminal" meta="~" icon="terminal" compact={compact} active={props.terminalActive ? 1 : 0} onPress={props.onToggleTerminal} /></Tooltip>
          <Tooltip label="Toggle hot panel" side="bottom" shortcut="Ctrl+H"><HeaderButton label="Hot" meta="H" icon="flame" compact={compact} active={props.hotActive ? 1 : 0} onPress={props.onToggleHot} /></Tooltip>
          <Tooltip label="Open plan view" side="bottom"><HeaderButton label="Plan" meta="M" icon="map" compact={compact} active={props.planActive ? 1 : 0} onPress={props.onTogglePlan} /></Tooltip>
          <Tooltip label="Open command palette" side="bottom" shortcut="Ctrl+K"><HeaderButton label="Palette" meta="P" icon="command" compact={compact} active={props.paletteActive ? 1 : 0} onPress={props.onOpenPalette} /></Tooltip>
          <Tooltip label="Open agent chat" side="bottom" shortcut="Ctrl+L"><HeaderButton label="Agent" icon="message" compact={compact} active={props.chatActive ? 1 : 0} onPress={props.onToggleChat} /></Tooltip>
        </Row>
        ) : null}
      </Row>
    </Col>
  );
}

export function CompactSurfaceButton(props: any) {
  return (
    <Tooltip label={props.tooltip || props.label} side="bottom" shortcut={props.shortcut}>
      <HoverPressable
        onPress={props.onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: props.showLabel ? 6 : 0,
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 7,
          paddingBottom: 7,
          borderRadius: TOKENS.radiusLg,
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
      </HoverPressable>
    </Tooltip>
  );
}
