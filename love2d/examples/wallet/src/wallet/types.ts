import type { NetworkId } from '../network/chains';

export type Screen =
  | 'welcome'
  | 'create'
  | 'create-confirm'
  | 'create-password'
  | 'import'
  | 'unlock'
  | 'dashboard'
  | 'send'
  | 'send-confirm'
  | 'receive'
  | 'settings';

export interface WalletAccount {
  address: string;
  index: number;
}

export interface WalletState {
  screen: Screen;
  accounts: WalletAccount[];
  activeAccountIndex: number;
  network: NetworkId;
  balance: bigint;
  balanceLoading: boolean;
  torConnected: boolean;
  useTor: boolean;
  mnemonic: string | null;     // only in memory during create/import flow
  privateKey: Uint8Array | null; // only in memory while unlocked
  hasKeystore: boolean;
  error: string | null;
  txHash: string | null;
}

export interface SendParams {
  to: string;
  value: string; // ETH amount as string
}
