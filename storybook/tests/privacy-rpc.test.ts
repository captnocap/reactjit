// Privacy RPC test — isolating crash
import { setPrivacyBridge, shamirSplit, shamirCombine } from '@reactjit/privacy';

const bridge = (globalThis as any).__rjitBridge;
if (bridge) {
  setPrivacyBridge(bridge);
}

test('bridge is available', async () => {
  if (!bridge) throw new Error('__rjitBridge not found');
});

test('shamir split/combine', async () => {
  const secret = 'deadbeefcafebabe';
  const shares = await shamirSplit(secret, 5, 3);
  if (shares.length !== 5) throw new Error(`Expected 5 shares, got ${shares.length}`);
  const recovered = await shamirCombine(shares.slice(0, 3));
  if (recovered !== secret) throw new Error(`Expected "${secret}", got "${recovered}"`);
});
