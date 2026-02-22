/**
 * Settings bridge — sends service registry to Lua and syncs keys.
 *
 * useSettingsRegistry() sends the service definitions to the Lua settings
 * overlay so it knows what fields to display. Call it once at app startup.
 *
 * @example
 * import { useSettingsRegistry, builtinServices } from '@reactjit/apis';
 *
 * function App() {
 *   useSettingsRegistry(); // uses builtinServices by default
 *   return <MyApp />;
 * }
 *
 * // Or with custom services:
 * useSettingsRegistry([...builtinServices, myCustomService]);
 */

import { useEffect, useRef } from 'react';
import { useBridgeOptional } from '../../core/src/context';
import { builtinServices, type ServiceDefinition } from './registry';

let registrySent = false;

/**
 * Send service registry to the Lua settings overlay.
 * Idempotent — only sends once per app lifecycle.
 *
 * @param services - Service definitions to register. Defaults to all built-in services.
 */
export function useSettingsRegistry(
  services: ServiceDefinition[] = builtinServices,
): void {
  const bridge = useBridgeOptional();
  const servicesRef = useRef(services);
  servicesRef.current = services;

  useEffect(() => {
    if (registrySent || !bridge) return;

    bridge.send('settings:registry', { services: servicesRef.current });
    bridge.flush();
    registrySent = true;
  }, [bridge]);
}

/**
 * Reset the registry sent flag. Useful for HMR.
 */
export function resetSettingsRegistry(): void {
  registrySent = false;
}
