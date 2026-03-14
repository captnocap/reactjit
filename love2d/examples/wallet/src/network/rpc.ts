import { chains, type Chain, type NetworkId } from './chains';

let _requestId = 0;
const TOR_PROXY = 'socks5://127.0.0.1:9050';

export interface RpcOptions {
  useTor?: boolean;
}

async function rpcCall(
  method: string,
  params: unknown[],
  chain: Chain,
  opts: RpcOptions = {}
): Promise<unknown> {
  const id = ++_requestId;
  const body = JSON.stringify({ jsonrpc: '2.0', method, params, id });

  const fetchOpts: any = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  };

  if (opts.useTor) {
    fetchOpts.proxy = TOR_PROXY;
  }

  const res = await fetch(chain.rpc, fetchOpts);
  const json = await res.json();

  if (json.error) {
    throw new Error(`RPC error ${json.error.code}: ${json.error.message}`);
  }

  return json.result;
}

// ── Public API ─────────────────────────────────────────

export async function getBalance(
  address: string,
  networkId: NetworkId,
  opts?: RpcOptions
): Promise<bigint> {
  const result = await rpcCall('eth_getBalance', [address, 'latest'], chains[networkId], opts);
  return BigInt(result as string);
}

export async function getNonce(
  address: string,
  networkId: NetworkId,
  opts?: RpcOptions
): Promise<bigint> {
  const result = await rpcCall('eth_getTransactionCount', [address, 'latest'], chains[networkId], opts);
  return BigInt(result as string);
}

export async function getGasPrice(
  networkId: NetworkId,
  opts?: RpcOptions
): Promise<bigint> {
  const result = await rpcCall('eth_gasPrice', [], chains[networkId], opts);
  return BigInt(result as string);
}

export async function getMaxPriorityFee(
  networkId: NetworkId,
  opts?: RpcOptions
): Promise<bigint> {
  const result = await rpcCall('eth_maxPriorityFeePerGas', [], chains[networkId], opts);
  return BigInt(result as string);
}

export async function estimateGas(
  tx: { from: string; to: string; value: string; data?: string },
  networkId: NetworkId,
  opts?: RpcOptions
): Promise<bigint> {
  const result = await rpcCall('eth_estimateGas', [tx], chains[networkId], opts);
  return BigInt(result as string);
}

export async function sendRawTransaction(
  signedTx: string,
  networkId: NetworkId,
  opts?: RpcOptions
): Promise<string> {
  const result = await rpcCall('eth_sendRawTransaction', [signedTx], chains[networkId], opts);
  return result as string;
}

export async function getBlockNumber(
  networkId: NetworkId,
  opts?: RpcOptions
): Promise<bigint> {
  const result = await rpcCall('eth_blockNumber', [], chains[networkId], opts);
  return BigInt(result as string);
}

// Format wei to ETH string with specified decimal places
export function formatEther(wei: bigint, decimals: number = 6): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return '0';
  if (eth < 0.000001) return '<0.000001';
  return eth.toFixed(decimals).replace(/\.?0+$/, '');
}

// Parse ETH string to wei
export function parseEther(eth: string): bigint {
  const [whole, frac = ''] = eth.split('.');
  const fracPadded = frac.padEnd(18, '0').slice(0, 18);
  return BigInt(whole + fracPadded);
}
