/**
 * ContextMenu -- Right-click context menu for web and native (Love2D) modes.
 *
 * This is a "Lua-owned interaction" primitive. In native mode, the context menu
 * UI (rendering, hover, keyboard nav) is handled entirely in Lua. JS only
 * receives boundary events: open, close, select.
 *
 * Web mode: renders children with an onContextMenu handler + positioned dropdown.
 * Native mode: emits a 'ContextMenu' host element — Lua's contextmenu.lua
 *              handles everything.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRendererMode } from './context';
import { Box, styleToCSS } from './primitives';
import type { ContextMenuProps, ContextMenuEvent, ContextMenuItem, LoveEvent } from './types';

// ── Web mode component ──────────────────────────────────

function WebContextMenu({
  items,
  onSelect,
  onOpen,
  onClose,
  children,
}: ContextMenuProps) {
  const [menuState, setMenuState] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!items || items.length === 0) return;
      e.preventDefault();
      setMenuState({ x: e.clientX, y: e.clientY });
      onOpen?.();
    },
    [items, onOpen],
  );

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled || item.separator) return;
      onSelect?.({ action: item.action });
      setMenuState(null);
      onClose?.();
    },
    [onSelect, onClose],
  );

  const handleClickOutside = useCallback(() => {
    if (menuState) {
      setMenuState(null);
      onClose?.();
    }
  }, [menuState, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!menuState) return;
    const handler = () => handleClickOutside();
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [menuState, handleClickOutside]);

  // Close on Escape
  useEffect(() => {
    if (!menuState) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuState(null);
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [menuState, onClose]);

  return (
    <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
      {children}
      {menuState && items && items.length > 0 && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: menuState.x,
            top: menuState.y,
            zIndex: 9999,
            background: 'rgba(30, 30, 40, 0.95)',
            border: '1px solid rgba(64, 64, 82, 0.8)',
            borderRadius: 6,
            padding: '4px 0',
            minWidth: 160,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) =>
            item.separator ? (
              <div
                key={i}
                style={{
                  height: 1,
                  margin: '4px 10px',
                  background: 'rgba(64, 64, 82, 0.5)',
                }}
              />
            ) : (
              <div
                key={i}
                onClick={() => handleItemClick(item)}
                style={{
                  padding: '6px 16px',
                  fontSize: 13,
                  color: item.disabled
                    ? 'rgba(115, 120, 128, 1)'
                    : 'rgba(217, 222, 232, 1)',
                  cursor: item.disabled ? 'default' : 'pointer',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) {
                    (e.target as HTMLElement).style.background =
                      'rgba(56, 89, 140, 0.55)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background = 'transparent';
                }}
              >
                {item.label}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ── Native mode component ──────────────────────────────

function NativeContextMenu({
  items,
  onSelect,
  onOpen,
  onClose,
  children,
}: ContextMenuProps) {
  const handleSelect = useCallback(
    (event: LoveEvent) => {
      const payload = event as any;
      onSelect?.({
        action: payload.action ?? '',
        targetId: payload.contextTargetId,
        hasSelection: payload.hasSelection ?? false,
        selectedText: payload.selectedText,
      });
    },
    [onSelect],
  );

  const handleOpen = useCallback(() => {
    onOpen?.();
  }, [onOpen]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Props that cross the bridge (Lua reads from node.props)
  const props: Record<string, any> = {};

  // Items are sent as props so Lua can read them from the node
  if (items && items.length > 0) {
    props.items = items;
  }

  // Handlers — extracted by reconciler's extractHandlers(), stored in handlerRegistry
  if (onSelect) props['onContextMenuSelect'] = handleSelect;
  if (onOpen) props['onContextMenuOpen'] = handleOpen;
  if (onClose) props['onContextMenuClose'] = handleClose;

  return React.createElement('ContextMenu', props, children);
}

// ── Public component ────────────────────────────────────

export function ContextMenu(props: ContextMenuProps) {
  const mode = useRendererMode();

  if (mode === 'web') {
    return <WebContextMenu {...props} />;
  }

  return <NativeContextMenu {...props} />;
}
