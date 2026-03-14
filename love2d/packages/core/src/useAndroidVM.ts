/**
 * useAndroidVM — Puppeteer-like control of Android VMs via ADB
 *
 * Works with VMs spawned by <Render source="*.iso" /> or any ADB-reachable device.
 *
 * Usage:
 *   const vm = useAndroidVM({ port: 5556 })
 *   await vm.connect()
 *   await vm.tap(500, 300)
 *   await vm.type("hello world")
 *   await vm.launch("com.android.chrome")
 *   await vm.key("HOME")
 *   const { output } = await vm.shell("getprop ro.build.version.release")
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useBridgeOptional } from './context';
import { useMount } from './useLuaEffect';

export interface AndroidVMOptions {
  port?: number;
  autoConnect?: boolean;
}

export interface AndroidDevice {
  serial: string;
  state: string;
  info: string;
}

export function useAndroidVM(options?: AndroidVMOptions) {
  const bridge = useBridgeOptional();
  const port = options?.port ?? 5556;
  const [connected, setConnected] = useState(false);
  const [booted, setBooted] = useState(false);
  const mountedRef = useRef(true);

  useMount(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  });

  // Auto-connect on mount if requested
  // rjit-ignore-next-line — Dep-driven: re-connects when bridge/autoConnect/port changes
  useEffect(() => {
    if (options?.autoConnect && bridge) {
      bridge.rpc('adb:connect', { port }).then((r: any) => {
        if (mountedRef.current && r?.ok) setConnected(true);
      }).catch(() => {});
    }
  }, [bridge, options?.autoConnect, port]);

  const connect = useCallback(async (p?: number) => {
    if (!bridge) return { error: 'no bridge' };
    const result = await bridge.rpc<any>('adb:connect', { port: p ?? port });
    if (mountedRef.current && result?.ok) setConnected(true);
    return result;
  }, [bridge, port]);

  const disconnect = useCallback(async () => {
    if (!bridge) return;
    await bridge.rpc('adb:disconnect', { port });
    if (mountedRef.current) setConnected(false);
  }, [bridge, port]);

  const shell = useCallback(async (command: string) => {
    if (!bridge) return { error: 'no bridge' };
    return bridge.rpc<{ output: string; error?: string }>('adb:shell', { command, port });
  }, [bridge, port]);

  const tap = useCallback(async (x: number, y: number) => {
    if (!bridge) return;
    return bridge.rpc('adb:tap', { x, y, port });
  }, [bridge, port]);

  const longpress = useCallback(async (x: number, y: number, duration?: number) => {
    if (!bridge) return;
    return bridge.rpc('adb:longpress', { x, y, duration, port });
  }, [bridge, port]);

  const swipe = useCallback(async (x1: number, y1: number, x2: number, y2: number, duration?: number) => {
    if (!bridge) return;
    return bridge.rpc('adb:swipe', { x1, y1, x2, y2, duration, port });
  }, [bridge, port]);

  const type = useCallback(async (text: string) => {
    if (!bridge) return;
    return bridge.rpc('adb:type', { text, port });
  }, [bridge, port]);

  const key = useCallback(async (keyName: string) => {
    if (!bridge) return;
    return bridge.rpc('adb:key', { key: keyName, port });
  }, [bridge, port]);

  const launch = useCallback(async (pkg: string, activity?: string) => {
    if (!bridge) return;
    return bridge.rpc('adb:launch', { package: pkg, activity, port });
  }, [bridge, port]);

  const install = useCallback(async (apkPath: string) => {
    if (!bridge) return;
    return bridge.rpc('adb:install', { path: apkPath, port });
  }, [bridge, port]);

  const uninstall = useCallback(async (pkg: string) => {
    if (!bridge) return;
    return bridge.rpc('adb:uninstall', { package: pkg, port });
  }, [bridge, port]);

  const screenshot = useCallback(async (outputPath?: string) => {
    if (!bridge) return;
    return bridge.rpc<{ ok: boolean; path: string }>('adb:screenshot', { output: outputPath, port });
  }, [bridge, port]);

  const getprop = useCallback(async (property?: string) => {
    if (!bridge) return;
    return bridge.rpc<any>('adb:getprop', { property, port });
  }, [bridge, port]);

  const packages = useCallback(async () => {
    if (!bridge) return;
    return bridge.rpc<{ packages: string[] }>('adb:packages', { port });
  }, [bridge, port]);

  const devices = useCallback(async () => {
    if (!bridge) return;
    return bridge.rpc<{ devices: AndroidDevice[] }>('adb:devices');
  }, [bridge]);

  const waitBoot = useCallback(async (timeout?: number) => {
    if (!bridge) return;
    const result = await bridge.rpc<any>('adb:wait-boot', { port, timeout }, (timeout ?? 120) * 1000 + 5000);
    if (mountedRef.current && result?.ok) setBooted(true);
    return result;
  }, [bridge, port]);

  const push = useCallback(async (localPath: string, remotePath: string) => {
    if (!bridge) return;
    return bridge.rpc('adb:push', { local: localPath, remote: remotePath, port });
  }, [bridge, port]);

  const pull = useCallback(async (remotePath: string, localPath: string) => {
    if (!bridge) return;
    return bridge.rpc('adb:pull', { remote: remotePath, local: localPath, port });
  }, [bridge, port]);

  return {
    connected,
    booted,
    port,
    // Connection
    connect,
    disconnect,
    // Input
    tap,
    longpress,
    swipe,
    type,
    key,
    // Apps
    launch,
    install,
    uninstall,
    packages,
    // System
    shell,
    screenshot,
    getprop,
    devices,
    waitBoot,
    // File transfer
    push,
    pull,
  };
}
