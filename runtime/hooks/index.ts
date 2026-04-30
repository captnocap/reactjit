/**
 * runtime/hooks — per-domain FFI wrappers for framework capabilities.
 *
 * Usage:
 *   import { fs, sqlite, http } from '../../runtime/hooks';
 *   const text = fs.readFile('/etc/hostname');
 *   const db = sqlite.Db.open('app.db');
 *   const r = await http.getAsync('https://example.com');
 */

export * as fs from './fs';
export { math, listZigCallable } from './math';
export type { Vec2, Vec3, BBox2, BBox3, SmoothDampResult } from './math';
export * as sqlite from './sqlite';
export * as http from './http';
export * as crypto from './crypto';
export * as process from './process';
export * as localstore from './localstore';
export * as clipboard from './clipboard';
export * as websocket from './websocket';
export * as media from './media';
export * as browserPage from './browser_page';
export { useHotState, removeHotState, clearHotState, hotStateKeys } from './useHotState';
export { useIFTTT, busOn, busEmit, getSharedState, setSharedState, dispatchClaudeEvent } from './useIFTTT';
export type { IFTTTTrigger, IFTTTAction, IFTTTResult } from './useIFTTT';
export {
  registerIfttSource,
  registerIfttAction,
  setIfttFallback,
  resolveTrigger,
  dispatchAction,
  listIfttSources,
  listIfttActions,
} from './ifttt-registry';
export type { IfttSource, IfttSubscription, IfttActionRunner } from './ifttt-registry';
export { compileTrigger, isComposable, substituteAction } from './ifttt-compose';
export type { IFTTTComposable, IFTTTLeaf } from './ifttt-compose';
export { useHost } from './useHost';
export type {
  HostSpec,
  HostHandle,
  HttpHostSpec,
  HttpHostHandle,
  WsHostSpec,
  WsHostHandle,
  ProcessHostSpec,
  ProcessHostHandle,
  HttpRequest,
  HttpResponder,
  HttpRouteSpec,
  HostState,
} from './useHost';
export { useConnection } from './useConnection';
export type {
  ConnectionSpec,
  ConnectionHandle,
  ConnectionState,
  TransportHandle,
  WsConnectionSpec,
  WsConnectionHandle,
  TcpConnectionSpec,
  TcpConnectionHandle,
  UdpConnectionSpec,
  UdpConnectionHandle,
  WireGuardConnectionSpec,
  WireGuardConnectionHandle,
  WireGuardConfig,
  TorConnectionSpec,
  TorConnectionHandle,
  Socks5ConnectionSpec,
  Socks5ConnectionHandle,
  StunConnectionSpec,
  StunConnectionHandle,
  PeerConnectionSpec,
  PeerConnectionHandle,
  HttpConnectionSpec,
  HttpConnectionHandle,
  SseConnectionSpec,
  SseConnectionHandle,
  SseEvent,
  RconConnectionSpec,
  RconConnectionHandle,
  A2sConnectionSpec,
  A2sConnectionHandle,
  A2sInfo,
  A2sPlayer,
} from './useConnection';
export {
  fuzzyScore,
  fuzzySearch,
  scoreFuzzyItem,
  useFuzzySearch,
} from './useFuzzySearch';
export type {
  FuzzyMode,
  FuzzySearchCandidate,
  FuzzySearchOptions,
  FuzzySearchResult,
} from './useFuzzySearch';
export { usePrivacy } from './usePrivacy';
export type {
  Backend as PrivacyBackend,
  PrivacyOptions,
  PrivacyAPI,
  Manifest,
  ManifestEntry,
  VerifyResult,
  KeyType,
  KeyringEntryView,
  GenerateKeyOpts,
  IsolatedCredential,
  NoiseInitiateResult,
  SecureBufferMode,
} from './usePrivacy';
export { useTelemetry } from './useTelemetry';
export type {
  TelemetrySpec,
  TelemetryResult,
  ScalarKind as TelemetryScalarKind,
  JsonKind as TelemetryJsonKind,
  NodeKind as TelemetryNodeKind,
  ScalarTelemetrySpec,
  JsonTelemetrySpec,
  NodeTelemetrySpec,
  ScalarTelemetryResult,
  JsonTelemetryResult,
} from './useTelemetry';
export { useCRUD } from './useCRUD';
export { useMedia } from './useMedia';
export { useVoiceInput } from './useVoiceInput';
export type { VoiceInputOptions, VoiceInputResult } from './useVoiceInput';
export { useFileWatch, attachWatcher } from './useFileWatch';
export type { FileWatchEvent, FileWatchOptions } from './useFileWatch';

// Scene3D scene-graph hook — lives in runtime/scene3d/, surfaced through
// the same hooks barrel so carts can pull `useScene3D` alongside the rest.
export { useScene3D, createScene3DRegistry, DEFAULT_CAMERA, Scene3DContext } from '../scene3d/useScene3D';
export type { Scene3DRegistry } from '../scene3d/useScene3D';
export type {
  Vec3 as Scene3DVec3,
  GeometryKind,
  CameraKind,
  BoxGeometry,
  SphereGeometry,
  PlaneGeometry,
  TorusGeometry,
  GeometryDescriptor,
  StandardMaterial,
  MeshNode,
  CameraNode,
  AmbientLightNode,
  DirectionalLightNode,
  PointLightNode,
  LightNode,
  Scene3DProps,
  CameraProps,
  MeshProps,
  AmbientLightProps,
  DirectionalLightProps,
  PointLightProps,
  OrbitControlsProps,
} from '../scene3d/types';

export * from '../ffi';

/**
 * Install ALL browser-shim globals so copy-pasted React code works:
 *   globalThis.fetch       → http
 *   globalThis.localStorage → localstore
 *   globalThis.WebSocket   → websocket
 *   globalThis.EventSource → http (streaming SSE)
 *
 * Call once at the top of your cart entry (before <App /> mounts). Leaving
 * the shims OFF by default keeps things explicit — opt in per cart.
 */
export function installBrowserShims(): void {
  const httpMod = require('./http') as typeof import('./http');
  httpMod.installFetchShim();
  httpMod.installEventSourceShim();
  (require('./localstore') as typeof import('./localstore')).installLocalStorageShim();
  (require('./websocket') as typeof import('./websocket')).installWebSocketShim();
}
