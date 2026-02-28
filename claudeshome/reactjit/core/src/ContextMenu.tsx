/**
 * ContextMenu -- Right-click context menu for native (Love2D) mode.
 *
 * This is a "Lua-owned interaction" primitive. The context menu UI
 * (rendering, hover, keyboard nav) is handled entirely in Lua. JS only
 * receives boundary events: open, close, select.
 */

import React, { useCallback } from 'react';
import type { ContextMenuProps, LoveEvent } from './types';

export function ContextMenu({
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
