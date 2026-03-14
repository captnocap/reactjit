export interface Chain {
  chainId: number;
  name: string;
  symbol: string;
  rpc: string;
  explorer: string;
  decimals: number;
}

export const chains: Record<string, Chain> = {
  mainnet: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
    decimals: 18,
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    symbol: 'ETH',
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    decimals: 18,
  },
};

export type NetworkId = keyof typeof chains;
