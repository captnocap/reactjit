/**
 * Philips Hue API hooks.
 * Auth: API key in URL path. Press link button then POST to /api to get a key.
 * https://developers.meethue.com/develop/get-started-2/
 */

import { useAPI, useAPIMutation, type APIResult } from './base';

// ── Types ───────────────────────────────────────────────

export interface HueLight {
  state: {
    on: boolean;
    bri: number;
    hue: number;
    sat: number;
    ct: number;
    xy: [number, number];
    colormode: 'hs' | 'xy' | 'ct';
    reachable: boolean;
    alert: string;
    effect: string;
  };
  type: string;
  name: string;
  modelid: string;
  manufacturername: string;
  productname: string;
  uniqueid: string;
}

export interface HueGroup {
  name: string;
  lights: string[];
  type: string;
  state: { all_on: boolean; any_on: boolean };
  action: HueLight['state'];
  class?: string;
}

export interface HueSensor {
  state: Record<string, any>;
  name: string;
  type: string;
  modelid: string;
  uniqueid: string;
  config: Record<string, any>;
}

export interface HueScene {
  name: string;
  type: string;
  group?: string;
  lights: string[];
  lightstates?: Record<string, Partial<HueLight['state']>>;
}

// ── Hooks ───────────────────────────────────────────────

function hueUrl(bridgeIp: string, apiKey: string, path: string): string {
  return `http://${bridgeIp}/api/${apiKey}${path}`;
}

export function useHueLights(
  bridgeIp: string | null,
  apiKey: string | null,
  opts?: { interval?: number },
): APIResult<Record<string, HueLight>> {
  return useAPI(
    bridgeIp && apiKey ? hueUrl(bridgeIp, apiKey, '/lights') : null,
    { interval: opts?.interval },
  );
}

export function useHueLight(
  bridgeIp: string | null,
  apiKey: string | null,
  lightId: string | null,
  opts?: { interval?: number },
): APIResult<HueLight> {
  return useAPI(
    bridgeIp && apiKey && lightId ? hueUrl(bridgeIp, apiKey, `/lights/${lightId}`) : null,
    { interval: opts?.interval },
  );
}

export function useHueGroups(
  bridgeIp: string | null,
  apiKey: string | null,
): APIResult<Record<string, HueGroup>> {
  return useAPI(
    bridgeIp && apiKey ? hueUrl(bridgeIp, apiKey, '/groups') : null,
  );
}

export function useHueSensors(
  bridgeIp: string | null,
  apiKey: string | null,
): APIResult<Record<string, HueSensor>> {
  return useAPI(
    bridgeIp && apiKey ? hueUrl(bridgeIp, apiKey, '/sensors') : null,
  );
}

export function useHueScenes(
  bridgeIp: string | null,
  apiKey: string | null,
): APIResult<Record<string, HueScene>> {
  return useAPI(
    bridgeIp && apiKey ? hueUrl(bridgeIp, apiKey, '/scenes') : null,
  );
}

export function useHueControl(bridgeIp: string | null, apiKey: string | null) {
  const { execute, loading, error } = useAPIMutation();
  const base = bridgeIp && apiKey ? `http://${bridgeIp}/api/${apiKey}` : null;

  return {
    setLight: (lightId: string, state: Partial<HueLight['state']>) =>
      base ? execute(`${base}/lights/${lightId}/state`, { method: 'PUT', body: state }) : Promise.reject(new Error('No bridge')),
    setGroup: (groupId: string, action: Partial<HueLight['state']>) =>
      base ? execute(`${base}/groups/${groupId}/action`, { method: 'PUT', body: action }) : Promise.reject(new Error('No bridge')),
    activateScene: (sceneId: string, groupId: string = '0') =>
      base ? execute(`${base}/groups/${groupId}/action`, { method: 'PUT', body: { scene: sceneId } }) : Promise.reject(new Error('No bridge')),
    loading,
    error,
  };
}

/** Convert Hue xy + brightness to a hex color (approximation) */
export function hueXYToHex(x: number, y: number, bri: number): string {
  const z = 1.0 - x - y;
  const Y = bri / 254;
  const X = (Y / y) * x;
  const Z = (Y / y) * z;

  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

  const gamma = (v: number) => v <= 0.0031308 ? 12.92 * v : (1.0 + 0.055) * Math.pow(v, 1.0 / 2.4) - 0.055;
  r = Math.max(0, Math.min(1, gamma(r)));
  g = Math.max(0, Math.min(1, gamma(g)));
  b = Math.max(0, Math.min(1, gamma(b)));

  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
