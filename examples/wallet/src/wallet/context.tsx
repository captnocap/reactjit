import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { useBridge, useLuaInterval, type IBridge } from '@reactjit/core';
import { generateMnemonic, isValidMnemonic, mnemonicToSeed, deriveAccount } from '../crypto/keys';
import { encryptKeystore, decryptKeystore, type EncryptedKeystore } from '../crypto/keystore';
import { signTransaction, type Transaction } from '../crypto/signing';
import { getBalance, getNonce, getGasPrice, getMaxPriorityFee, estimateGas, sendRawTransaction, formatEther, parseEther } from '../network/rpc';
import { chains, type NetworkId } from '../network/chains';
import type { WalletState, Screen, SendParams } from './types';

// ── Storage helpers (Love2D RPC to storage.lua) ──

function storageSet(bridge: IBridge, collection: string, id: string, data: any) {
  bridge.rpc('storage:set', { collection, id, data: JSON.stringify(data), format: 'json' }).catch(() => {});
}

async function storageGet<T>(bridge: IBridge, collection: string, id: string): Promise<T | null> {
  try {
    const result = await bridge.rpc<string>('storage:get', { collection, id, format: 'json' });
    return result ? JSON.parse(result) : null;
  } catch {
    return null;
  }
}

// ── Reducer ─────────────────────────────────────────────

type Action =
  | { type: 'SET_SCREEN'; screen: Screen }
  | { type: 'SET_MNEMONIC'; mnemonic: string }
  | { type: 'UNLOCK'; privateKey: Uint8Array; address: string }
  | { type: 'LOCK' }
  | { type: 'SET_BALANCE'; balance: bigint }
  | { type: 'SET_BALANCE_LOADING'; loading: boolean }
  | { type: 'SET_NETWORK'; network: NetworkId }
  | { type: 'SET_TOR'; connected: boolean }
  | { type: 'SET_USE_TOR'; useTor: boolean }
  | { type: 'SET_HAS_KEYSTORE'; has: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_TX_HASH'; hash: string | null };

const initialState: WalletState = {
  screen: 'welcome',
  accounts: [],
  activeAccountIndex: 0,
  network: 'sepolia',
  balance: 0n,
  balanceLoading: false,
  torConnected: false,
  useTor: true,
  mnemonic: null,
  privateKey: null,
  hasKeystore: false,
  error: null,
  txHash: null,
};

function reducer(state: WalletState, action: Action): WalletState {
  switch (action.type) {
    case 'SET_SCREEN':
      return { ...state, screen: action.screen, error: null };
    case 'SET_MNEMONIC':
      return { ...state, mnemonic: action.mnemonic };
    case 'UNLOCK':
      return {
        ...state,
        privateKey: action.privateKey,
        accounts: [{ address: action.address, index: 0 }],
        screen: 'dashboard',
        error: null,
      };
    case 'LOCK':
      return {
        ...state,
        privateKey: null,
        mnemonic: null,
        balance: 0n,
        screen: 'unlock',
        txHash: null,
      };
    case 'SET_BALANCE':
      return { ...state, balance: action.balance, balanceLoading: false };
    case 'SET_BALANCE_LOADING':
      return { ...state, balanceLoading: action.loading };
    case 'SET_NETWORK':
      return { ...state, network: action.network, balance: 0n };
    case 'SET_TOR':
      return { ...state, torConnected: action.connected };
    case 'SET_USE_TOR':
      return { ...state, useTor: action.useTor };
    case 'SET_HAS_KEYSTORE':
      return { ...state, hasKeystore: action.has };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_TX_HASH':
      return { ...state, txHash: action.hash };
    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────

interface WalletActions {
  navigate: (screen: Screen) => void;
  createWallet: () => string;
  importWallet: (mnemonic: string) => boolean;
  setPassword: (password: string) => void;
  unlock: (password: string) => void;
  lock: () => void;
  refreshBalance: () => void;
  switchNetwork: (network: NetworkId) => void;
  toggleTor: () => void;
  send: (params: SendParams) => Promise<void>;
  clearError: () => void;
}

const WalletContext = createContext<{ state: WalletState; actions: WalletActions } | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

// ── Provider ────────────────────────────────────────────

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  const bridge = useBridge();
  const bridgeRef = useRef(bridge);
  stateRef.current = state;
  bridgeRef.current = bridge;

  // Check for existing keystore on mount
  useEffect(() => {
    storageGet<EncryptedKeystore>(bridge, 'wallet', 'keystore').then(store => {
      if (store) {
        dispatch({ type: 'SET_HAS_KEYSTORE', has: true });
        dispatch({ type: 'SET_SCREEN', screen: 'unlock' });
      }
    });

    storageGet<{ network: NetworkId; useTor: boolean }>(bridge, 'wallet', 'settings').then(settings => {
      if (settings) {
        if (settings.network) dispatch({ type: 'SET_NETWORK', network: settings.network });
        if (settings.useTor !== undefined) dispatch({ type: 'SET_USE_TOR', useTor: settings.useTor });
      }
    });
  }, [bridge]);

  // Auto-refresh balance every 30s when unlocked
  const shouldPollBalance = state.screen === 'dashboard' && state.accounts.length > 0;
  useLuaInterval(shouldPollBalance ? 30000 : null, () => {
    const s = stateRef.current;
    if (s.accounts.length === 0) return;
    dispatch({ type: 'SET_BALANCE_LOADING', loading: true });
    getBalance(s.accounts[0].address, s.network, { useTor: s.useTor })
      .then(bal => dispatch({ type: 'SET_BALANCE', balance: bal }))
      .catch(err => {
        dispatch({ type: 'SET_BALANCE_LOADING', loading: false });
        console.warn('Balance fetch failed:', err.message);
      });
  });

  const actions: WalletActions = {
    navigate: useCallback((screen: Screen) => {
      dispatch({ type: 'SET_SCREEN', screen });
    }, []),

    createWallet: useCallback(() => {
      const mnemonic = generateMnemonic();
      dispatch({ type: 'SET_MNEMONIC', mnemonic });
      dispatch({ type: 'SET_SCREEN', screen: 'create' });
      return mnemonic;
    }, []),

    importWallet: useCallback((mnemonic: string) => {
      const trimmed = mnemonic.trim().toLowerCase();
      if (!isValidMnemonic(trimmed)) {
        dispatch({ type: 'SET_ERROR', error: 'Invalid mnemonic phrase' });
        return false;
      }
      dispatch({ type: 'SET_MNEMONIC', mnemonic: trimmed });
      dispatch({ type: 'SET_SCREEN', screen: 'create-password' });
      return true;
    }, []),

    setPassword: useCallback((password: string) => {
      const s = stateRef.current;
      if (!s.mnemonic) return;

      try {
        const store = encryptKeystore(s.mnemonic, password);
        storageSet(bridgeRef.current, 'wallet', 'keystore', store);
        dispatch({ type: 'SET_HAS_KEYSTORE', has: true });

        // Derive key and unlock
        const seed = mnemonicToSeed(s.mnemonic);
        const account = deriveAccount(seed);
        dispatch({ type: 'UNLOCK', privateKey: account.privateKey, address: account.address });
      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message || 'Encryption failed' });
      }
    }, []),

    unlock: useCallback((password: string) => {
      storageGet<EncryptedKeystore>(bridgeRef.current, 'wallet', 'keystore').then(store => {
        if (!store) {
          dispatch({ type: 'SET_ERROR', error: 'No keystore found' });
          return;
        }
        try {
          const mnemonic = decryptKeystore(store, password);
          const seed = mnemonicToSeed(mnemonic);
          const account = deriveAccount(seed);
          dispatch({ type: 'UNLOCK', privateKey: account.privateKey, address: account.address });
        } catch {
          dispatch({ type: 'SET_ERROR', error: 'Wrong password' });
        }
      }).catch(err => {
        dispatch({ type: 'SET_ERROR', error: err.message });
      });
    }, []),

    lock: useCallback(() => {
      dispatch({ type: 'LOCK' });
    }, []),

    refreshBalance: useCallback(() => {
      const s = stateRef.current;
      if (s.accounts.length === 0) return;
      dispatch({ type: 'SET_BALANCE_LOADING', loading: true });
      getBalance(s.accounts[0].address, s.network, { useTor: s.useTor })
        .then(bal => dispatch({ type: 'SET_BALANCE', balance: bal }))
        .catch(() => dispatch({ type: 'SET_BALANCE_LOADING', loading: false }));
    }, []),

    switchNetwork: useCallback((network: NetworkId) => {
      dispatch({ type: 'SET_NETWORK', network });
      const s = stateRef.current;
      storageSet(bridgeRef.current, 'wallet', 'settings', { network, useTor: s.useTor });
    }, []),

    toggleTor: useCallback(() => {
      const s = stateRef.current;
      const newVal = !s.useTor;
      dispatch({ type: 'SET_USE_TOR', useTor: newVal });
      storageSet(bridgeRef.current, 'wallet', 'settings', { network: s.network, useTor: newVal });
    }, []),

    send: useCallback(async (params: SendParams) => {
      const s = stateRef.current;
      if (!s.privateKey || s.accounts.length === 0) {
        dispatch({ type: 'SET_ERROR', error: 'Wallet not unlocked' });
        return;
      }

      try {
        dispatch({ type: 'SET_ERROR', error: null });
        const chain = chains[s.network];
        const address = s.accounts[0].address;
        const rpcOpts = { useTor: s.useTor };

        const [nonce, gasPrice, priorityFee] = await Promise.all([
          getNonce(address, s.network, rpcOpts),
          getGasPrice(s.network, rpcOpts),
          getMaxPriorityFee(s.network, rpcOpts).catch(() => 1000000000n), // 1 gwei fallback
        ]);

        const valueWei = parseEther(params.value);
        const gasLimit = await estimateGas(
          { from: address, to: params.to, value: '0x' + valueWei.toString(16) },
          s.network, rpcOpts
        ).catch(() => 21000n); // standard ETH transfer

        const tx: Transaction = {
          chainId: BigInt(chain.chainId),
          nonce,
          maxPriorityFeePerGas: priorityFee,
          maxFeePerGas: gasPrice * 2n, // 2x base fee for safety
          gasLimit,
          to: params.to,
          value: valueWei,
          data: '0x',
          accessList: [],
        };

        const signedTx = signTransaction(tx, s.privateKey);
        const txHash = await sendRawTransaction(signedTx, s.network, rpcOpts);

        dispatch({ type: 'SET_TX_HASH', hash: txHash });
        dispatch({ type: 'SET_SCREEN', screen: 'dashboard' });

        // Refresh balance after send
        setTimeout(() => {
          getBalance(address, s.network, rpcOpts)
            .then(bal => dispatch({ type: 'SET_BALANCE', balance: bal }))
            .catch(() => {});
        }, 5000);

      } catch (err: any) {
        dispatch({ type: 'SET_ERROR', error: err.message || 'Transaction failed' });
      }
    }, []),

    clearError: useCallback(() => {
      dispatch({ type: 'SET_ERROR', error: null });
    }, []),
  };

  return (
    <WalletContext.Provider value={{ state, actions }}>
      {children}
    </WalletContext.Provider>
  );
}
