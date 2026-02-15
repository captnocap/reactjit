/**
 * Minimal no-op IBridge for storybook stories.
 *
 * Stories that don't interact with a game backend just need a bridge
 * that satisfies the context without doing anything. Interactive stories
 * (Slider, Switch, etc.) use local React state instead of bridge state.
 */

import type { IBridge, Listener, Unsubscribe } from '../../../packages/shared/src/bridge';

export class StoryBridge implements IBridge {
  private listeners = new Map<string, Set<Listener>>();
  private state = new Map<string, any>();

  send(_type: string, _payload?: any): void {}
  flush(): void {}

  subscribe(type: string, fn: Listener): Unsubscribe {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
    return () => { this.listeners.get(type)?.delete(fn); };
  }

  async rpc<T = any>(): Promise<T> { return {} as T; }

  setState(key: string, value: any): void {
    this.state.set(key, value);
    this.listeners.get(`state:${key}`)?.forEach(fn => fn(value));
  }

  isReady(): boolean { return true; }
  onReady(cb: () => void): void { cb(); }
  destroy(): void { this.listeners.clear(); }
}
