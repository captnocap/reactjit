import { useEffect, useState } from 'react';
import { socketSupport, type SocketProtocol } from '../../../lib/game-servers/support';

export function useServerPing(address: string, protocol: SocketProtocol) {
  const support = socketSupport(protocol);
  const [ping, setPing] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!support.available || !address) {
      setPing(null);
      setPending(false);
      return;
    }
    setPending(true);
    const started = Date.now();
    const timer = setTimeout(() => {
      setPending(false);
      setPing(Date.now() - started);
    }, 0);
    return () => clearTimeout(timer);
  }, [address, protocol, support.available]);

  return { ping, pending, available: support.available, banner: support.banner, hostFns: support.present };
}

