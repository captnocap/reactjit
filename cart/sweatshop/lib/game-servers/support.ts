const host: any = globalThis as any;

export type SocketProtocol = 'udp' | 'tcp';

export type SocketSupport = {
  available: boolean;
  present: string[];
  missing: string[];
  banner: string;
};

export const UDP_SOCKET_FNS = ['__socket_udp_open', '__socket_udp_connect', '__socket_udp_send', '__socket_udp_recv', '__socket_udp_close'];
export const TCP_SOCKET_FNS = ['__socket_tcp_open', '__socket_tcp_connect', '__socket_tcp_send', '__socket_tcp_recv', '__socket_tcp_close'];

export function listSocketHostFunctions(): string[] {
  return Object.keys(host).filter((name) => name.startsWith('__socket_') && typeof host[name] === 'function').sort();
}

export function hasSocketHostFunction(name: string): boolean {
  return typeof host[name] === 'function';
}

export function socketSupport(protocol: SocketProtocol): SocketSupport {
  const candidates = protocol === 'udp' ? UDP_SOCKET_FNS : TCP_SOCKET_FNS;
  const present: string[] = [];
  const missing: string[] = [];
  for (const name of candidates) {
    if (hasSocketHostFunction(name)) present.push(name);
    else missing.push(name);
  }
  return {
    available: missing.length === 0 && present.length > 0,
    present,
    missing,
    banner: missing.length === 0 ? 'socket bindings ready' : 'socket bindings pending',
  };
}

export function protocolBanner(protocols: SocketProtocol[]): string {
  const missing: string[] = [];
  if (protocols.includes('udp')) missing.push('Valve / Steam server browser needs __socket_udp_* bindings');
  if (protocols.includes('tcp')) missing.push('Minecraft SLP needs __socket_tcp_* bindings');
  return missing.join(' | ');
}

export function normalizeAddress(address: string): string {
  return String(address || '').trim();
}
