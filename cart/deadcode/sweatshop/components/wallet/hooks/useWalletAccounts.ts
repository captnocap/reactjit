import { useCallback } from 'react';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { createId, normalizeAddress, type WalletAccount } from '../lib';

const STORE_KEY = 'sweatshop.wallet.accounts.v1';

function readAccounts(): WalletAccount[] {
  return [];
}

export function useWalletAccounts() {
  const [accounts, setAccounts] = usePersistentState<WalletAccount[]>(STORE_KEY, readAccounts());

  const addAccount = useCallback((label: string, address: string) => {
    const cleanAddress = normalizeAddress(address);
    const cleanLabel = String(label || '').trim() || cleanAddress.slice(0, 12) || 'Watch Account';
    if (!cleanAddress) return;
    setAccounts((prev) => {
      if (prev.some((item) => item.address.toLowerCase() === cleanAddress.toLowerCase())) {
        return prev.map((item) => (
          item.address.toLowerCase() === cleanAddress.toLowerCase()
            ? { ...item, label: cleanLabel, address: cleanAddress }
            : item
        ));
      }
      return prev.concat([{ id: createId('acct'), label: cleanLabel, address: cleanAddress }]);
    });
  }, [setAccounts]);

  const updateAccount = useCallback((id: string, next: Partial<WalletAccount>) => {
    setAccounts((prev) => prev.map((item) => (item.id === id ? { ...item, ...next, address: normalizeAddress(next.address ?? item.address) } : item)));
  }, [setAccounts]);

  const removeAccount = useCallback((id: string) => {
    setAccounts((prev) => prev.filter((item) => item.id !== id));
  }, [setAccounts]);

  return { accounts, addAccount, updateAccount, removeAccount, setAccounts };
}
