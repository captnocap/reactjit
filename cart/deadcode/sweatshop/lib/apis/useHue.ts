import { useAPI, useAPIMutation } from './base';
import { useServiceKey } from './useServiceKey';

export interface HueConfig { bridgeIp?: string; apiKey?: string; }

export function useHue(config?: HueConfig) {
  const keys = useServiceKey('hue');
  const bridgeIp = config?.bridgeIp ?? keys.bridgeIp;
  const apiKey = config?.apiKey ?? keys.apiKey;
  const base = apiKey && bridgeIp ? `http://${bridgeIp}/api/${apiKey}` : null;

  const lights = () => useAPI<any>(base ? `${base}/lights` : null);
  const light = (id: string) => useAPI<any>(base && id ? `${base}/lights/${id}` : null);
  const setLightState = (id: string) =>
    useAPIMutation<any>(base && id ? `${base}/lights/${id}/state` : '', { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
  const groups = () => useAPI<any>(base ? `${base}/groups` : null);

  return { lights, light, setLightState, groups };
}
