/**
 * useTray — System tray icon with context menu.
 *
 * Creates a persistent indicator in the system notification area (tray)
 * with a right-click context menu. Menu item clicks fire callbacks.
 *
 * @example
 * useTray({
 *   id: 'my-server',
 *   icon: '/path/to/icon.png',
 *   title: 'Game Server',
 *   menu: [
 *     { label: 'Open Dashboard', action: 'open' },
 *     { label: 'Restart', action: 'restart' },
 *     { separator: true },
 *     { label: 'Quit', action: 'quit' },
 *   ],
 *   onAction: (action) => {
 *     if (action === 'quit') bridge.rpc('window:close');
 *   },
 * });
 */

import { useRef, useCallback } from 'react';
import { useBridge } from './context';
// rjit-ignore-next-line
import { useEffect } from 'react';

export interface TrayMenuItem {
  /** Display label */
  label?: string;
  /** Action identifier sent back on click */
  action?: string;
  /** Render as a separator line */
  separator?: boolean;
  /** Render as a toggle/checkbox item */
  toggle?: boolean;
  /** Initial checked state (for toggle items) */
  checked?: boolean;
}

export interface TrayOptions {
  /** Unique identifier for this tray indicator */
  id: string;
  /** Absolute path to icon PNG (or icon theme name) */
  icon?: string;
  /** Tooltip / title text */
  title?: string;
  /** Menu items */
  menu?: TrayMenuItem[];
  /** Category: 'application' | 'communications' | 'system' | 'hardware' | 'other' */
  category?: string;
  /** Called when a menu item is clicked */
  onAction?: (action: string, data?: { checked?: boolean }) => void;
}

export function useTray(opts: TrayOptions): {
  updateMenu: (menu: TrayMenuItem[]) => void;
  setStatus: (status: 'active' | 'passive' | 'attention') => void;
  setIcon: (icon: string) => void;
  setLabel: (label: string) => void;
  destroy: () => void;
} {
  const bridge = useBridge();
  const onActionRef = useRef(opts.onAction);
  onActionRef.current = opts.onAction;
  const createdRef = useRef(false);
  const id = opts.id;

  // Create tray on mount, destroy on unmount
  // rjit-ignore-next-line
  useEffect(() => {
    bridge.rpc('tray:create', {
      id: opts.id,
      icon: opts.icon,
      title: opts.title,
      menu: opts.menu,
      category: opts.category,
    });
    createdRef.current = true;

    // Subscribe to tray action events
    const unsub = bridge.subscribe('tray:action', (payload: any) => {
      if (payload.id === id && onActionRef.current) {
        onActionRef.current(payload.action, {
          checked: payload.checked,
        });
      }
    });

    return () => {
      unsub();
      if (createdRef.current) {
        bridge.rpc('tray:destroy', { id });
        createdRef.current = false;
      }
    };
  }, [bridge, id]); // eslint-disable-line

  const updateMenu = useCallback(
    (menu: TrayMenuItem[]) => bridge.rpc('tray:update_menu', { id, menu }),
    [bridge, id]
  );

  const setStatus = useCallback(
    (status: 'active' | 'passive' | 'attention') =>
      bridge.rpc('tray:set_status', { id, status }),
    [bridge, id]
  );

  const setIcon = useCallback(
    (icon: string) => bridge.rpc('tray:set_icon', { id, icon }),
    [bridge, id]
  );

  const setLabel = useCallback(
    (label: string) => bridge.rpc('tray:set_label', { id, label }),
    [bridge, id]
  );

  const destroy = useCallback(() => {
    bridge.rpc('tray:destroy', { id });
    createdRef.current = false;
  }, [bridge, id]);

  return { updateMenu, setStatus, setIcon, setLabel, destroy };
}
