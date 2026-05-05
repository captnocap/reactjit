import { useCallback } from 'react';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { createId, normalizeAddress, type WalletContact } from '../lib';

const STORE_KEY = 'sweatshop.wallet.contacts.v1';

export function useAddressBook() {
  const [contacts, setContacts] = usePersistentState<WalletContact[]>(STORE_KEY, []);

  const addContact = useCallback((label: string, address: string) => {
    const cleanAddress = normalizeAddress(address);
    const cleanLabel = String(label || '').trim() || cleanAddress.slice(0, 12) || 'Contact';
    if (!cleanAddress) return;
    setContacts((prev) => {
      const match = prev.find((item) => item.address.toLowerCase() === cleanAddress.toLowerCase());
      if (match) {
        return prev.map((item) => (
          item.address.toLowerCase() === cleanAddress.toLowerCase()
            ? { ...item, label: cleanLabel, address: cleanAddress }
            : item
        ));
      }
      return prev.concat([{ id: createId('contact'), label: cleanLabel, address: cleanAddress }]);
    });
  }, [setContacts]);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((item) => item.id !== id));
  }, [setContacts]);

  return { contacts, addContact, removeContact, setContacts };
}

