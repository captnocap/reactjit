const React: any = require('react');
const { useCallback, useEffect, useMemo, useState } = React;

import { Box, Col, Pressable, Row, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { Icon } from './icons';
import { Tooltip } from './tooltip';

export type MenuBarAction = {
  kind?: 'item' | 'separator';
  label: string;
  shortcut?: string;
  disabled?: boolean;
  action?: () => void;
};

export type MenuBarSection = {
  label: string;
  items: MenuBarAction[];
};

type MenuBarProps = {
  sections: MenuBarSection[];
};

function menuActionStyle(disabled: boolean) {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    opacity: disabled ? 0.45 : 1,
  };
}

function menuSeparator() {
  return <Box style={{ height: 1, backgroundColor: COLORS.border, marginLeft: 8, marginRight: 8 }} />;
}

export function MenuBar(props: MenuBarProps) {
  const [menuVisible, setMenuVisible] = useState(0);
  const [openSection, setOpenSection] = useState('');
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [altHeld, setAltHeld] = useState(false);
  const openIndex = useMemo(() => {
    if (!menuVisible) return -1;
    if (!openSection) return -1;
    return props.sections.findIndex((section) => section.label === openSection);
  }, [menuVisible, openSection, props.sections]);
  const openItems = useMemo(() => {
    if (openIndex < 0) return [];
    return props.sections[openIndex].items;
  }, [openIndex, props.sections]);

  const firstSelectableIndex = useCallback((items: MenuBarAction[]) => {
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].kind !== 'separator') return i;
    }
    return -1;
  }, []);

  const nextSelectableIndex = useCallback((items: MenuBarAction[], startIndex: number, delta: number) => {
    if (items.length === 0) return -1;
    let next = startIndex;
    for (let i = 0; i < items.length; i += 1) {
      next = (next + delta + items.length) % items.length;
      if (items[next].kind !== 'separator') return next;
    }
    return -1;
  }, []);

  const openMenu = useCallback((label: string) => {
    const index = props.sections.findIndex((section) => section.label === label);
    if (index < 0) return;
    setMenuVisible(1);
    setOpenSection(label);
    const first = firstSelectableIndex(props.sections[index].items);
    setSelectedItemIndex(first >= 0 ? first : 0);
  }, [firstSelectableIndex, props.sections]);

  const cycleMenu = useCallback((delta: number) => {
    if (props.sections.length === 0) return;
    const currentIndex = openIndex >= 0 ? openIndex : 0;
    const nextIndex = (currentIndex + delta + props.sections.length) % props.sections.length;
    const nextSection = props.sections[nextIndex];
    setMenuVisible(1);
    setOpenSection(nextSection.label);
    const first = firstSelectableIndex(nextSection.items);
    setSelectedItemIndex(first >= 0 ? first : 0);
  }, [firstSelectableIndex, openIndex, props.sections]);

  const closeMenu = useCallback(() => setOpenSection(''), []);
  const hideMenuBar = useCallback(() => {
    setOpenSection('');
    setMenuVisible(0);
  }, []);

  const activateSelected = useCallback(() => {
    if (openIndex < 0) return;
    const item = openItems[selectedItemIndex];
    if (!item || item.kind === 'separator' || item.disabled || !item.action) return;
    hideMenuBar();
    item.action();
  }, [hideMenuBar, openIndex, openItems, selectedItemIndex]);

  const moveSelection = useCallback((delta: number) => {
    if (openIndex < 0 || openItems.length === 0) return;
    const current = selectedItemIndex >= 0 ? selectedItemIndex : 0;
    const next = nextSelectableIndex(openItems, current, delta);
    if (next >= 0) setSelectedItemIndex(next);
  }, [nextSelectableIndex, openIndex, openItems, selectedItemIndex]);

  useEffect(() => {
    if (openIndex < 0) {
      setSelectedItemIndex(0);
      return;
    }
    const first = firstSelectableIndex(openItems);
    setSelectedItemIndex(first >= 0 ? first : 0);
  }, [firstSelectableIndex, openIndex, openItems]);

  useEffect(() => {
    const handler = (event: any) => {
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      const alt = !!event.altKey;

      if (event.repeat) return;

      if (key === 'alt' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault?.();
        if (menuVisible) hideMenuBar();
        else {
          setMenuVisible(1);
          setAltHeld(true);
        }
        return;
      }

      if (alt && !event.ctrlKey && !event.metaKey) {
        setAltHeld(true);
      }

      if (alt && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        if (key === 'f') { event.preventDefault?.(); openMenu('File'); return; }
        if (key === 'e') { event.preventDefault?.(); openMenu('Edit'); return; }
        if (key === 'v') { event.preventDefault?.(); openMenu('View'); return; }
        if (key === 'h') { event.preventDefault?.(); openMenu('Help'); return; }
      }

      if (!menuVisible || openIndex < 0) {
        if (key === 'escape' && menuVisible) {
          event.preventDefault?.();
          hideMenuBar();
        }
        return;
      }

      if (key === 'escape') {
        event.preventDefault?.();
        hideMenuBar();
        return;
      }

      if (key === 'arrowleft') {
        event.preventDefault?.();
        cycleMenu(-1);
        return;
      }

      if (key === 'arrowright') {
        event.preventDefault?.();
        cycleMenu(1);
        return;
      }

      if (key === 'arrowdown') {
        event.preventDefault?.();
        moveSelection(1);
        return;
      }

      if (key === 'arrowup') {
        event.preventDefault?.();
        moveSelection(-1);
        return;
      }

      if (key === 'enter') {
        event.preventDefault?.();
        activateSelected();
      }
    };

    const upHandler = (event: any) => {
      const key = typeof event.key === 'string' ? event.key.toLowerCase() : '';
      if (key === 'alt') setAltHeld(false);
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', upHandler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [activateSelected, cycleMenu, hideMenuBar, menuVisible, moveSelection, openIndex, openMenu]);

  const renderMenuLabel = useCallback((label: string) => {
    if (!label) return null;
    const first = label.slice(0, 1);
    const rest = label.slice(1);
    return (
      <Row style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', textDecorationLine: altHeld ? 'underline' : 'none' }}>
          {first}
        </Text>
        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>
          {rest}
        </Text>
      </Row>
    );
  }, [altHeld]);

  if (!props.sections || props.sections.length === 0 || !menuVisible) return null;

  return (
    <Col style={{ position: 'absolute', left: 0, right: 0, top: 42, zIndex: 2200, overflow: 'visible', backgroundColor: COLORS.panelBg, borderBottomWidth: 1, borderColor: COLORS.border }}>
      <Row style={{ alignItems: 'center', gap: 2, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, minHeight: 28 }}>
        {props.sections.map((section, index) => {
          const open = openSection === section.label;
          return (
            <Tooltip label={'Open ' + section.label + ' menu'} side="bottom">
              <Pressable
                key={section.label}
                onPress={() => {
                  if (open) closeMenu();
                  else openMenu(section.label);
                }}
                style={{
                  minWidth: 76,
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderRadius: 8,
                  backgroundColor: open ? COLORS.blueDeep : 'transparent',
                  borderWidth: 1,
                  borderColor: open ? COLORS.blue : 'transparent',
                }}
                >
                <Row style={{ alignItems: 'center', gap: 4 }}>
                  {renderMenuLabel(section.label)}
                  {open ? <Icon name="chevron-down" size={10} color={COLORS.blue} /> : null}
                </Row>
              </Pressable>
            </Tooltip>
          );
        })}
      </Row>

      <Box style={{ position: 'absolute', left: 0, right: 0, top: 28, bottom: 0, zIndex: 2300, overflow: 'visible' }}>
        <Pressable onPress={hideMenuBar} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
        {openIndex >= 0 ? (
          <Col
            style={{
              position: 'absolute',
              left: 8 + openIndex * 82,
              top: 8,
              width: 220,
              paddingTop: 6,
              paddingBottom: 6,
              backgroundColor: COLORS.panelRaised,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 12,
              overflow: 'hidden',
              zIndex: 2400,
            }}
          >
            {openItems.map((item, index) => (
              <React.Fragment key={(item.kind || 'item') + ':' + index + ':' + item.label}>
                {item.kind === 'separator' ? (
                  menuSeparator()
                ) : (
                  <Tooltip label={item.disabled ? item.label + ' (disabled)' : 'Run ' + item.label} side="right">
                    <Pressable
                      onPress={() => {
                        if (item.disabled) return;
                        if (!item.action) return;
                        hideMenuBar();
                        item.action();
                      }}
                      style={{
                        ...menuActionStyle(!!item.disabled),
                        backgroundColor: index === selectedItemIndex ? COLORS.blueDeep : 'transparent',
                      }}
                    >
                      <Text fontSize={11} color={item.disabled ? COLORS.textDim : COLORS.textBright} style={{ fontWeight: 'bold' }}>
                        {item.label}
                      </Text>
                      {item.shortcut ? <Text fontSize={9} color={COLORS.textDim}>{item.shortcut}</Text> : <Box style={{ width: 1, height: 1 }} />}
                    </Pressable>
                  </Tooltip>
                )}
              </React.Fragment>
            ))}
          </Col>
        ) : null}
      </Box>
    </Col>
  );
}
