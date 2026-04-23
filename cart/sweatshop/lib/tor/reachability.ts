// Tor reachability probe.
//
// HOST-BINDING NOTE: framework/net/socks5.zig exists (P12), but there is
// no JS binding yet — no __socket_tcp_connect registered in any
// v8_bindings_*.zig. Until the Zig side exposes a JS bridge for raw TCP
// connects, we probe with the host `__exec` path using the kernel's own
// TCP stack (via /dev/tcp in bash, plus a PROTOCOLINFO handshake on the
// control port). That IS a real probe against a real port — the SYN
// originates from the same kernel any TCP binding would use — it just
// goes via shell out and back, not through the in-process socket API.
// When __socket_tcp_connect lands, swap the probe path and keep the
// same return shape.

export type ReachabilityResult = {
  hasSocks: boolean;       // 127.0.0.1:9050 accepting TCP
  hasControl: boolean;     // 127.0.0.1:9051 accepting TCP and speaking Tor control protocol
  socksRaw?: string;       // socket-open byte (SOCKS5 greeting response) if captured
  controlBanner?: string;  // first PROTOCOLINFO response line if captured
  probedAt: number;
  error?: string;          // set when __exec is unavailable; hosts without it see an explicit gap
};

function hostExec(): ((cmd: string) => string | null) {
  const h: any = globalThis as any;
  if (typeof h.__exec !== 'function') return () => null;
  return (cmd: string) => {
    try {
      const out = h.__exec(cmd);
      if (out == null) return null;
      if (typeof out === 'string') return out;
      if (typeof out.then === 'function') return null;   // async not expected here
      return String(out);
    } catch { return null; }
  };
}

// Probe a TCP port via bash's /dev/tcp. Exits 0 iff the connect succeeds.
// Returns the raw stdout captured inside the 2s window (may be empty).
function probePort(host: string, port: number, timeoutSec = 2): { open: boolean; raw: string } {
  const exec = hostExec();
  const script = [
    'timeout ' + timeoutSec + ' bash -c \'',
    '(exec 3<>/dev/tcp/' + host + '/' + port + ') 2>/dev/null || { echo __CLOSED__; exit 1; }',
    '\'',
  ].join('');
  const out = exec(script);
  if (out == null) return { open: false, raw: '' };
  if (out.indexOf('__CLOSED__') >= 0) return { open: false, raw: '' };
  return { open: true, raw: out };
}

// Control-port confirmation: send PROTOCOLINFO; Tor replies with a line
// beginning "250-PROTOCOLINFO 1". Non-Tor listeners on 9051 won't match.
function probeControlPort(host: string, port: number, timeoutSec = 2): { isTor: boolean; banner: string } {
  const exec = hostExec();
  const script = [
    'timeout ' + timeoutSec + ' bash -c \'',
    'exec 3<>/dev/tcp/' + host + '/' + port + ' || exit 2; ',
    'printf "PROTOCOLINFO\\r\\nQUIT\\r\\n" >&3; ',
    'head -n 1 <&3',
    '\' 2>/dev/null',
  ].join('');
  const out = exec(script);
  if (out == null) return { isTor: false, banner: '' };
  const line = (out || '').split(/\r?\n/)[0] || '';
  return { isTor: /^250[- ]PROTOCOLINFO/.test(line), banner: line };
}

export function probeReachability(): ReachabilityResult {
  const h: any = globalThis as any;
  const at = Date.now();
  if (typeof h.__exec !== 'function') {
    return { hasSocks: false, hasControl: false, probedAt: at, error: 'host __exec missing — cannot probe 127.0.0.1 ports' };
  }
  const socks = probePort('127.0.0.1', 9050);
  const control = probePort('127.0.0.1', 9051);
  const controlChk = control.open ? probeControlPort('127.0.0.1', 9051) : { isTor: false, banner: '' };
  return {
    hasSocks: socks.open,
    hasControl: control.open && controlChk.isTor,
    socksRaw: socks.raw || undefined,
    controlBanner: controlChk.banner || undefined,
    probedAt: at,
  };
}
