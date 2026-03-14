/**
 * subscriptionManager.ts — Reconciler-managed bridge subscriptions
 *
 * When a node has bridge subscription props (__subscribe, __subscribeKey, etc.),
 * the reconciler manages subscribe/unsubscribe tied to node lifecycle.
 * No useEffect needed — the reconciler IS the lifecycle manager.
 *
 * Used by: BridgeEvent, Hotkey, and any future subscription-based components.
 */

import type { IBridge } from '@reactjit/core';

// Bridge reference — set once during init
let _bridge: IBridge | null = null;

// Node subscriptions: nodeId -> { eventType -> unsubscribe fn }
const subscriptions = new Map<number, Map<string, () => void>>();

/**
 * Set the bridge reference. Called once from Love2DApp during init.
 */
export function setSubscriptionBridge(bridge: IBridge): void {
  _bridge = bridge;
}

/**
 * Called from createInstance / commitUpdate when a node has subscription props.
 * Manages bridge.subscribe() calls tied to node lifecycle.
 *
 * @param nodeId    The node's unique ID
 * @param eventType Bridge event type to subscribe to (e.g. 'viewport', 'keydown')
 * @param handlerFn The handler registry lookup — we don't store the fn here,
 *                  we route through the handler registry so React's reconciler
 *                  keeps handler refs fresh automatically.
 */
export function manageSubscription(
  nodeId: number,
  eventType: string | null | undefined,
  handlerName: string,
  getHandler: () => ((payload: any) => void) | undefined,
  filter?: (payload: any) => boolean,
): void {
  if (!_bridge) return;

  let nodeSubs = subscriptions.get(nodeId);

  // Unsubscribe from previous subscription for this handler
  if (nodeSubs) {
    const existing = nodeSubs.get(handlerName);
    if (existing) {
      existing();
      nodeSubs.delete(handlerName);
    }
  }

  // Subscribe to new event type
  if (eventType) {
    if (!nodeSubs) {
      nodeSubs = new Map();
      subscriptions.set(nodeId, nodeSubs);
    }

    const unsub = _bridge.subscribe(eventType, (payload: any) => {
      if (filter && !filter(payload)) return;
      const handler = getHandler();
      if (handler) handler(payload);
    });

    nodeSubs.set(handlerName, unsub);
  }
}

/**
 * Called from removeChild / cleanupHandlers when a node is removed.
 * Unsubscribes all bridge subscriptions for this node.
 */
export function cleanupSubscriptions(nodeId: number): void {
  const nodeSubs = subscriptions.get(nodeId);
  if (!nodeSubs) return;

  for (const unsub of nodeSubs.values()) {
    unsub();
  }
  subscriptions.delete(nodeId);
}

/**
 * Recursively cleanup subscriptions for a node and all descendants.
 */
export function cleanupSubscriptionsRecursive(
  node: { id: number; children?: any[] },
): void {
  cleanupSubscriptions(node.id);
  if (node.children) {
    for (const child of node.children) {
      if ('id' in child) {
        cleanupSubscriptionsRecursive(child);
      }
    }
  }
}
